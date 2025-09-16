import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { verifyToken } from './auth';
import { storage } from './storage';
import { User } from '@shared/schema';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  user?: User;
  projectId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  lastPing: number;
}

export interface WebSocketMessage {
  type: 'auth' | 'join_project' | 'leave_project' | 'cursor_move' | 'annotation_update' | 
        'project_update' | 'activity' | 'ping' | 'pong' | 'presence_update' | 'typing';
  payload?: any;
  timestamp: number;
  messageId?: string;
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_moved' | 'annotation_created' | 
        'annotation_updated' | 'annotation_deleted' | 'project_updated' | 'activity_logged' |
        'presence_changed' | 'typing_started' | 'typing_stopped';
  userId: number;
  username: string;
  projectId: string;
  data?: any;
  timestamp: number;
}

export class CollaborationWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private projectSessions: Map<string, Set<string>> = new Map(); // projectId -> Set of sessionIds
  private userSessions: Map<number, Set<string>> = new Map(); // userId -> Set of sessionIds
  private heartbeatInterval: NodeJS.Timeout;
  private sessionCleanupInterval: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startSessionCleanup();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
      const sessionId = this.generateSessionId();
      ws.sessionId = sessionId;
      ws.isAuthenticated = false;
      ws.lastPing = Date.now();

      this.clients.set(sessionId, ws);

      console.log(`WebSocket connection established: ${sessionId}`);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'auth',
        payload: { 
          message: 'Connected to Dillin.ai collaboration server',
          sessionId,
          requiresAuth: true
        },
        timestamp: Date.now()
      });

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });

      ws.on('pong', () => {
        ws.lastPing = Date.now();
      });
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      // Update last activity
      ws.lastPing = Date.now();

      switch (message.type) {
        case 'auth':
          await this.handleAuthentication(ws, message);
          break;

        case 'join_project':
          await this.handleJoinProject(ws, message);
          break;

        case 'leave_project':
          await this.handleLeaveProject(ws, message);
          break;

        case 'cursor_move':
          this.handleCursorMove(ws, message);
          break;

        case 'annotation_update':
          await this.handleAnnotationUpdate(ws, message);
          break;

        case 'project_update':
          await this.handleProjectUpdate(ws, message);
          break;

        case 'typing':
          this.handleTyping(ws, message);
          break;

        case 'presence_update':
          this.handlePresenceUpdate(ws, message);
          break;

        case 'ping':
          this.sendMessage(ws, {
            type: 'pong',
            timestamp: Date.now()
          });
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private async handleAuthentication(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    try {
      const { token } = message.payload;

      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      const payload = verifyToken(token);
      if (!payload || payload.type !== 'access') {
        this.sendError(ws, 'Invalid authentication token');
        return;
      }

      const user = await storage.getUser(payload.userId);
      if (!user || !user.isActive) {
        this.sendError(ws, 'User not found or inactive');
        return;
      }

      // Authenticate the connection
      ws.userId = user.id;
      ws.user = user;
      ws.isAuthenticated = true;

      // Track user sessions
      if (!this.userSessions.has(user.id)) {
        this.userSessions.set(user.id, new Set());
      }
      this.userSessions.get(user.id)!.add(ws.sessionId!);

      console.log(`User authenticated: ${user.username} (${ws.sessionId})`);

      this.sendMessage(ws, {
        type: 'auth',
        payload: {
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName
          }
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendError(ws, 'Authentication failed');
    }
  }

  private async handleJoinProject(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.isAuthenticated || !ws.userId) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    try {
      const { projectId } = message.payload;

      // Verify user has access to project
      const project = await storage.getProject(projectId);
      if (!project) {
        this.sendError(ws, 'Project not found');
        return;
      }

      const userRole = await storage.getUserProjectRole(projectId, ws.userId);
      const hasAccess = project.ownerId === ws.userId || userRole !== null || project.isPublic;

      if (!hasAccess) {
        this.sendError(ws, 'Access denied to project');
        return;
      }

      // Join project session
      ws.projectId = projectId;

      if (!this.projectSessions.has(projectId)) {
        this.projectSessions.set(projectId, new Set());
      }
      this.projectSessions.get(projectId)!.add(ws.sessionId!);

      // Create collaboration session in database
      await storage.createCollaborationSession({
        projectId,
        userId: ws.userId,
        socketId: ws.sessionId!,
        currentView: message.payload.currentView || 'cytoscape'
      });

      console.log(`User ${ws.user?.username} joined project ${projectId}`);

      // Notify other users in the project
      this.broadcastToProject(projectId, {
        type: 'user_joined',
        userId: ws.userId,
        username: ws.user?.username || 'Unknown',
        projectId,
        data: {
          sessionId: ws.sessionId,
          currentView: message.payload.currentView
        },
        timestamp: Date.now()
      }, ws.sessionId);

      // Send current project users to the joining user
      const activeSessions = await storage.getProjectActiveSessions(projectId);
      const activeUsers = await Promise.all(
        activeSessions
          .filter(session => session.socketId !== ws.sessionId)
          .map(async (session) => {
            const user = await storage.getUser(session.userId);
            return {
              userId: session.userId,
              username: user?.username || 'Unknown',
              sessionId: session.socketId,
              currentView: session.currentView,
              lastSeen: session.lastSeenAt
            };
          })
      );

      this.sendMessage(ws, {
        type: 'join_project',
        payload: {
          projectId,
          activeUsers,
          userRole
        },
        timestamp: Date.now()
      });

      // Log activity
      await storage.createActivityLog({
        userId: ws.userId,
        projectId,
        action: 'join',
        targetType: 'project',
        targetId: projectId,
        details: {
          event: 'realtime_collaboration_joined'
        },
        metadata: {}
      });
    } catch (error) {
      console.error('Join project error:', error);
      this.sendError(ws, 'Failed to join project');
    }
  }

  private async handleLeaveProject(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.projectId || !ws.userId) return;

    await this.removeUserFromProject(ws);
  }

  private async removeUserFromProject(ws: AuthenticatedWebSocket) {
    if (!ws.projectId || !ws.userId) return;

    const projectId = ws.projectId;

    // Remove from project sessions
    const projectSessions = this.projectSessions.get(projectId);
    if (projectSessions) {
      projectSessions.delete(ws.sessionId!);
      if (projectSessions.size === 0) {
        this.projectSessions.delete(projectId);
      }
    }

    // End collaboration session in database
    if (ws.sessionId) {
      await storage.endCollaborationSession(ws.sessionId);
    }

    console.log(`User ${ws.user?.username} left project ${projectId}`);

    // Notify other users
    this.broadcastToProject(projectId, {
      type: 'user_left',
      userId: ws.userId,
      username: ws.user?.username || 'Unknown',
      projectId,
      data: {
        sessionId: ws.sessionId
      },
      timestamp: Date.now()
    }, ws.sessionId);

    // Log activity
    await storage.createActivityLog({
      userId: ws.userId,
      projectId,
      action: 'leave',
      targetType: 'project',
      targetId: projectId,
      details: {
        event: 'realtime_collaboration_left'
      },
      metadata: {}
    });

    ws.projectId = undefined;
  }

  private handleCursorMove(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.isAuthenticated || !ws.projectId || !ws.userId) return;

    // Broadcast cursor position to other users in the project
    this.broadcastToProject(ws.projectId, {
      type: 'cursor_moved',
      userId: ws.userId,
      username: ws.user?.username || 'Unknown',
      projectId: ws.projectId,
      data: {
        position: message.payload.position,
        viewMode: message.payload.viewMode
      },
      timestamp: Date.now()
    }, ws.sessionId);

    // Update collaboration session with cursor position
    if (ws.sessionId) {
      storage.updateCollaborationSession(ws.sessionId, {
        cursorPosition: message.payload.position,
        currentView: message.payload.viewMode
      });
    }
  }

  private async handleAnnotationUpdate(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.isAuthenticated || !ws.projectId || !ws.userId) return;

    const { action, annotation } = message.payload;

    // Broadcast annotation change to other users in the project
    this.broadcastToProject(ws.projectId, {
      type: `annotation_${action}` as any,
      userId: ws.userId,
      username: ws.user?.username || 'Unknown',
      projectId: ws.projectId,
      data: {
        annotation,
        action
      },
      timestamp: Date.now()
    }, ws.sessionId);
  }

  private async handleProjectUpdate(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.isAuthenticated || !ws.projectId || !ws.userId) return;

    const { updates, version } = message.payload;

    // Broadcast project update to other users
    this.broadcastToProject(ws.projectId, {
      type: 'project_updated',
      userId: ws.userId,
      username: ws.user?.username || 'Unknown',
      projectId: ws.projectId,
      data: {
        updates,
        version
      },
      timestamp: Date.now()
    }, ws.sessionId);
  }

  private handleTyping(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.isAuthenticated || !ws.projectId || !ws.userId) return;

    const { isTyping, targetId, targetType } = message.payload;

    // Broadcast typing indicator to other users
    this.broadcastToProject(ws.projectId, {
      type: isTyping ? 'typing_started' : 'typing_stopped',
      userId: ws.userId,
      username: ws.user?.username || 'Unknown',
      projectId: ws.projectId,
      data: {
        targetId,
        targetType
      },
      timestamp: Date.now()
    }, ws.sessionId);
  }

  private handlePresenceUpdate(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.isAuthenticated || !ws.projectId || !ws.userId) return;

    const { presence } = message.payload;

    // Broadcast presence update to other users
    this.broadcastToProject(ws.projectId, {
      type: 'presence_changed',
      userId: ws.userId,
      username: ws.user?.username || 'Unknown',
      projectId: ws.projectId,
      data: {
        presence
      },
      timestamp: Date.now()
    }, ws.sessionId);

    // Update collaboration session
    if (ws.sessionId) {
      storage.updateCollaborationSession(ws.sessionId, {
        currentView: presence.currentView
      });
    }
  }

  private broadcastToProject(projectId: string, event: CollaborationEvent, excludeSessionId?: string) {
    const projectSessions = this.projectSessions.get(projectId);
    if (!projectSessions) return;

    const message: WebSocketMessage = {
      type: 'activity',
      payload: event,
      timestamp: Date.now()
    };

    projectSessions.forEach(sessionId => {
      if (sessionId !== excludeSessionId) {
        const client = this.clients.get(sessionId);
        if (client && client.readyState === WebSocket.OPEN) {
          this.sendMessage(client, message);
        }
      }
    });
  }

  private broadcastToUser(userId: number, event: any, excludeSessionId?: string) {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions) return;

    userSessions.forEach(sessionId => {
      if (sessionId !== excludeSessionId) {
        const client = this.clients.get(sessionId);
        if (client && client.readyState === WebSocket.OPEN) {
          this.sendMessage(client, event);
        }
      }
    });
  }

  private async handleDisconnection(ws: AuthenticatedWebSocket) {
    if (!ws.sessionId) return;

    console.log(`WebSocket disconnected: ${ws.sessionId}`);

    // Remove user from project if they were in one
    if (ws.projectId && ws.userId) {
      await this.removeUserFromProject(ws);
    }

    // Clean up user sessions
    if (ws.userId) {
      const userSessions = this.userSessions.get(ws.userId);
      if (userSessions) {
        userSessions.delete(ws.sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(ws.userId);
        }
      }
    }

    // Remove from clients
    this.clients.delete(ws.sessionId);

    // End collaboration session
    if (ws.sessionId) {
      await storage.endCollaborationSession(ws.sessionId);
    }
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: AuthenticatedWebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'auth',
      payload: {
        error,
        authenticated: false
      },
      timestamp: Date.now()
    });
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws, sessionId) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if client is still alive
          if (Date.now() - ws.lastPing > 60000) { // 60 seconds timeout
            console.log(`Terminating inactive connection: ${sessionId}`);
            ws.terminate();
            return;
          }

          // Send ping
          ws.ping();
        } else {
          // Clean up dead connections
          this.clients.delete(sessionId);
        }
      });
    }, 30000); // Every 30 seconds
  }

  private startSessionCleanup() {
    this.sessionCleanupInterval = setInterval(async () => {
      try {
        const cleaned = await storage.cleanupInactiveSessions();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} inactive collaboration sessions`);
        }
      } catch (error) {
        console.error('Session cleanup error:', error);
      }
    }, 300000); // Every 5 minutes
  }

  // Public methods for external use

  public notifyAnnotationChange(projectId: string, annotation: any, action: string, userId: number, username: string) {
    this.broadcastToProject(projectId, {
      type: `annotation_${action}` as any,
      userId,
      username,
      projectId,
      data: { annotation, action },
      timestamp: Date.now()
    });
  }

  public notifyProjectUpdate(projectId: string, updates: any, userId: number, username: string) {
    this.broadcastToProject(projectId, {
      type: 'project_updated',
      userId,
      username,
      projectId,
      data: { updates },
      timestamp: Date.now()
    });
  }

  public notifyActivity(projectId: string, activity: any, userId: number, username: string) {
    this.broadcastToProject(projectId, {
      type: 'activity_logged',
      userId,
      username,
      projectId,
      data: { activity },
      timestamp: Date.now()
    });
  }

  public getActiveUsers(projectId: string): number {
    const projectSessions = this.projectSessions.get(projectId);
    return projectSessions ? projectSessions.size : 0;
  }

  public getConnectedUsers(): number {
    return this.clients.size;
  }

  public shutdown() {
    clearInterval(this.heartbeatInterval);
    clearInterval(this.sessionCleanupInterval);
    
    this.clients.forEach(ws => {
      ws.close(1000, 'Server shutting down');
    });
    
    this.wss.close();
  }
}

export let collaborationWS: CollaborationWebSocketServer | null = null;

export function setupWebSocketServer(server: Server): CollaborationWebSocketServer {
  collaborationWS = new CollaborationWebSocketServer(server);
  return collaborationWS;
}