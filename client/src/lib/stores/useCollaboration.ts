import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Project, Annotation, SharedLink, Team, User, ActivityLog } from '@shared/schema';

export interface CollaborationUser {
  id: number;
  username: string;
  fullName?: string;
  sessionId: string;
  currentView: string;
  cursorPosition?: { x: number; y: number };
  lastSeen: Date;
  isTyping?: boolean;
  presence?: 'active' | 'idle' | 'away';
}

export interface CollaborationState {
  // Authentication
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;

  // Current project
  currentProject: Project | null;
  userRole: 'owner' | 'admin' | 'editor' | 'viewer' | null;
  
  // Real-time collaboration
  webSocket: WebSocket | null;
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  activeUsers: CollaborationUser[];
  sessionId: string | null;

  // Projects
  projects: Project[];
  isLoadingProjects: boolean;

  // Annotations
  annotations: Annotation[];
  selectedAnnotation: Annotation | null;
  isLoadingAnnotations: boolean;
  annotationFilters: {
    type?: string;
    userId?: number;
    dateRange?: { start: Date; end: Date };
  };

  // Sharing
  sharedLinks: SharedLink[];
  isLoadingSharedLinks: boolean;
  currentShareLink: SharedLink | null;

  // Teams
  teams: Team[];
  currentTeam: Team | null;
  isLoadingTeams: boolean;

  // Activity
  activityFeed: ActivityLog[];
  isLoadingActivity: boolean;

  // UI State
  isSharingModalOpen: boolean;
  isAnnotationToolbarVisible: boolean;
  isCollaborationSidebarOpen: boolean;
  isProjectModalOpen: boolean;
  selectedView: 'cytoscape' | 'timeline' | 'orbit' | 'universe' | null;

  // Typing indicators
  typingUsers: Map<string, { userId: number; username: string; targetId: string; targetType: string }>;

  // Actions
  // Authentication
  login: (credentials: { username: string; password: string }) => Promise<boolean>;
  logout: () => void;
  register: (userData: { username: string; email: string; password: string; fullName?: string }) => Promise<boolean>;
  checkAuth: () => Promise<boolean>;

  // WebSocket
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  sendMessage: (message: any) => void;
  handleWebSocketMessage: (message: any) => void;

  // Projects
  loadProjects: () => Promise<void>;
  createProject: (project: Partial<Project>) => Promise<Project | null>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  openProject: (projectId: string) => Promise<boolean>;
  closeProject: () => void;
  saveCurrentSession: () => Promise<boolean>;

  // Annotations
  loadAnnotations: (projectId?: string) => Promise<void>;
  createAnnotation: (annotation: Partial<Annotation>) => Promise<Annotation | null>;
  updateAnnotation: (annotationId: string, updates: Partial<Annotation>) => Promise<boolean>;
  deleteAnnotation: (annotationId: string) => Promise<boolean>;
  selectAnnotation: (annotation: Annotation | null) => void;
  filterAnnotations: (filters: any) => void;

  // Sharing
  loadSharedLinks: (projectId?: string) => Promise<void>;
  createSharedLink: (linkData: Partial<SharedLink>) => Promise<SharedLink | null>;
  updateSharedLink: (linkId: string, updates: Partial<SharedLink>) => Promise<boolean>;
  deleteSharedLink: (linkId: string) => Promise<boolean>;
  generateQRCode: (linkId: string) => Promise<string | null>;

  // Teams
  loadTeams: () => Promise<void>;
  createTeam: (team: Partial<Team>) => Promise<Team | null>;
  joinTeam: (inviteCode: string) => Promise<boolean>;
  leaveTeam: (teamId: string) => Promise<boolean>;
  updateTeamMember: (teamId: string, userId: number, role: string) => Promise<boolean>;

  // Activity
  loadActivity: (projectId?: string, teamId?: string) => Promise<void>;

  // UI Actions
  toggleSharingModal: (open?: boolean) => void;
  toggleAnnotationToolbar: (visible?: boolean) => void;
  toggleCollaborationSidebar: (open?: boolean) => void;
  toggleProjectModal: (open?: boolean) => void;
  setSelectedView: (view: string) => void;

  // Real-time handlers
  handleUserJoined: (user: CollaborationUser) => void;
  handleUserLeft: (sessionId: string) => void;
  handleCursorMove: (userId: number, position: { x: number; y: number }) => void;
  handleTypingStart: (userId: number, username: string, targetId: string, targetType: string) => void;
  handleTypingStop: (userId: number) => void;
}

// API utilities
const API_BASE = '/api';

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = useCollaboration.getState().token;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const useCollaboration = create<CollaborationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    user: null,
    isAuthenticated: false,
    token: localStorage.getItem('dillin_token'),
    
    currentProject: null,
    userRole: null,
    
    webSocket: null,
    isConnected: false,
    connectionStatus: 'disconnected',
    activeUsers: [],
    sessionId: null,

    projects: [],
    isLoadingProjects: false,

    annotations: [],
    selectedAnnotation: null,
    isLoadingAnnotations: false,
    annotationFilters: {},

    sharedLinks: [],
    isLoadingSharedLinks: false,
    currentShareLink: null,

    teams: [],
    currentTeam: null,
    isLoadingTeams: false,

    activityFeed: [],
    isLoadingActivity: false,

    isSharingModalOpen: false,
    isAnnotationToolbarVisible: false,
    isCollaborationSidebarOpen: false,
    isProjectModalOpen: false,
    selectedView: null,

    typingUsers: new Map(),

    // Authentication actions
    login: async (credentials) => {
      try {
        const response = await apiCall('/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });

        const { user, token } = response;
        localStorage.setItem('dillin_token', token);
        
        set({
          user,
          token,
          isAuthenticated: true,
        });

        // Connect to WebSocket after login
        get().connectWebSocket();
        
        return true;
      } catch (error) {
        console.error('Login error:', error);
        return false;
      }
    },

    logout: () => {
      localStorage.removeItem('dillin_token');
      get().disconnectWebSocket();
      
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        currentProject: null,
        userRole: null,
        activeUsers: [],
        sessionId: null,
      });
    },

    register: async (userData) => {
      try {
        const response = await apiCall('/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData),
        });

        const { user, token } = response;
        localStorage.setItem('dillin_token', token);
        
        set({
          user,
          token,
          isAuthenticated: true,
        });

        get().connectWebSocket();
        
        return true;
      } catch (error) {
        console.error('Registration error:', error);
        return false;
      }
    },

    checkAuth: async () => {
      const token = get().token;
      if (!token) return false;

      try {
        const response = await apiCall('/auth/me');
        set({
          user: response.user,
          isAuthenticated: true,
        });

        get().connectWebSocket();
        
        return true;
      } catch (error) {
        console.error('Auth check error:', error);
        get().logout();
        return false;
      }
    },

    // WebSocket actions
    connectWebSocket: () => {
      const { isAuthenticated, token, webSocket } = get();
      
      if (!isAuthenticated || !token || webSocket) return;

      set({ connectionStatus: 'connecting' });

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
          set({ 
            webSocket: ws, 
            isConnected: true, 
            connectionStatus: 'connected' 
          });

          // Authenticate WebSocket connection
          ws.send(JSON.stringify({
            type: 'auth',
            payload: { token },
            timestamp: Date.now(),
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            get().handleWebSocketMessage(message);
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          set({ 
            webSocket: null, 
            isConnected: false, 
            connectionStatus: 'disconnected',
            activeUsers: [],
            sessionId: null,
          });

          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            if (get().isAuthenticated) {
              get().connectWebSocket();
            }
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          set({ connectionStatus: 'error' });
        };

      } catch (error) {
        console.error('WebSocket connection error:', error);
        set({ connectionStatus: 'error' });
      }
    },

    disconnectWebSocket: () => {
      const { webSocket } = get();
      if (webSocket) {
        webSocket.close();
        set({ 
          webSocket: null, 
          isConnected: false, 
          connectionStatus: 'disconnected',
          activeUsers: [],
          sessionId: null,
        });
      }
    },

    sendMessage: (message) => {
      const { webSocket, isConnected } = get();
      if (webSocket && isConnected) {
        webSocket.send(JSON.stringify({
          ...message,
          timestamp: Date.now(),
        }));
      }
    },

    handleWebSocketMessage: (message: any) => {
      const { type, payload } = message;

      switch (type) {
        case 'auth':
          if (payload.authenticated) {
            set({ sessionId: payload.sessionId });
          }
          break;

        case 'join_project':
          set({ 
            activeUsers: payload.activeUsers || [],
            userRole: payload.userRole,
          });
          break;

        case 'activity':
          const event = payload;
          switch (event.type) {
            case 'user_joined':
              get().handleUserJoined(event.data);
              break;
            case 'user_left':
              get().handleUserLeft(event.data.sessionId);
              break;
            case 'cursor_moved':
              get().handleCursorMove(event.userId, event.data.position);
              break;
            case 'typing_started':
              get().handleTypingStart(event.userId, event.username, event.data.targetId, event.data.targetType);
              break;
            case 'typing_stopped':
              get().handleTypingStop(event.userId);
              break;
            case 'annotation_created':
            case 'annotation_updated':
            case 'annotation_deleted':
              get().loadAnnotations();
              break;
            case 'project_updated':
              get().loadProjects();
              break;
          }
          break;
      }
    },

    // Project actions
    loadProjects: async () => {
      set({ isLoadingProjects: true });
      try {
        const response = await apiCall('/projects');
        set({ projects: response.projects });
      } catch (error) {
        console.error('Load projects error:', error);
      } finally {
        set({ isLoadingProjects: false });
      }
    },

    createProject: async (project) => {
      try {
        const response = await apiCall('/projects', {
          method: 'POST',
          body: JSON.stringify(project),
        });
        
        // Reload projects
        await get().loadProjects();
        
        return response.project;
      } catch (error) {
        console.error('Create project error:', error);
        return null;
      }
    },

    updateProject: async (projectId, updates) => {
      try {
        await apiCall(`/projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        
        await get().loadProjects();
        
        return true;
      } catch (error) {
        console.error('Update project error:', error);
        return false;
      }
    },

    deleteProject: async (projectId) => {
      try {
        await apiCall(`/projects/${projectId}`, {
          method: 'DELETE',
        });
        
        await get().loadProjects();
        
        return true;
      } catch (error) {
        console.error('Delete project error:', error);
        return false;
      }
    },

    openProject: async (projectId) => {
      try {
        const response = await apiCall(`/projects/${projectId}`);
        const project = response.project;
        
        set({ 
          currentProject: project,
          userRole: response.userRole,
        });

        // Join project collaboration session
        get().sendMessage({
          type: 'join_project',
          payload: { 
            projectId,
            currentView: get().selectedView || 'cytoscape'
          },
        });

        // Load project-specific data
        await Promise.all([
          get().loadAnnotations(projectId),
          get().loadSharedLinks(projectId),
          get().loadActivity(projectId),
        ]);
        
        return true;
      } catch (error) {
        console.error('Open project error:', error);
        return false;
      }
    },

    closeProject: () => {
      const { currentProject } = get();
      
      if (currentProject) {
        // Leave project collaboration session
        get().sendMessage({
          type: 'leave_project',
          payload: { projectId: currentProject.id },
        });
      }

      set({ 
        currentProject: null,
        userRole: null,
        activeUsers: [],
        annotations: [],
        selectedAnnotation: null,
        activityFeed: [],
      });
    },

    saveCurrentSession: async () => {
      const { currentProject } = get();
      if (!currentProject) return false;

      try {
        const sessionData = {
          // Add current app state here
          selectedView: get().selectedView,
          // Add more state as needed
        };

        await apiCall(`/projects/${currentProject.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            sessionData,
            lastUpdated: new Date(),
          }),
        });
        
        return true;
      } catch (error) {
        console.error('Save session error:', error);
        return false;
      }
    },

    // Annotation actions
    loadAnnotations: async (projectId) => {
      set({ isLoadingAnnotations: true });
      try {
        const id = projectId || get().currentProject?.id;
        if (!id) return;

        const response = await apiCall(`/annotations?projectId=${id}`);
        set({ annotations: response.annotations });
      } catch (error) {
        console.error('Load annotations error:', error);
      } finally {
        set({ isLoadingAnnotations: false });
      }
    },

    createAnnotation: async (annotation) => {
      try {
        const response = await apiCall('/annotations', {
          method: 'POST',
          body: JSON.stringify(annotation),
        });
        
        await get().loadAnnotations();
        
        return response.annotation;
      } catch (error) {
        console.error('Create annotation error:', error);
        return null;
      }
    },

    updateAnnotation: async (annotationId, updates) => {
      try {
        await apiCall(`/annotations/${annotationId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        
        await get().loadAnnotations();
        
        return true;
      } catch (error) {
        console.error('Update annotation error:', error);
        return false;
      }
    },

    deleteAnnotation: async (annotationId) => {
      try {
        await apiCall(`/annotations/${annotationId}`, {
          method: 'DELETE',
        });
        
        await get().loadAnnotations();
        
        return true;
      } catch (error) {
        console.error('Delete annotation error:', error);
        return false;
      }
    },

    selectAnnotation: (annotation) => {
      set({ selectedAnnotation: annotation });
    },

    filterAnnotations: (filters) => {
      set({ annotationFilters: filters });
    },

    // Sharing actions
    loadSharedLinks: async (projectId) => {
      set({ isLoadingSharedLinks: true });
      try {
        const id = projectId || get().currentProject?.id;
        const endpoint = id ? `/sharing/project/${id}` : '/sharing';
        
        const response = await apiCall(endpoint);
        set({ sharedLinks: response.sharedLinks });
      } catch (error) {
        console.error('Load shared links error:', error);
      } finally {
        set({ isLoadingSharedLinks: false });
      }
    },

    createSharedLink: async (linkData) => {
      try {
        const response = await apiCall('/sharing', {
          method: 'POST',
          body: JSON.stringify(linkData),
        });
        
        await get().loadSharedLinks();
        
        return response.sharedLink;
      } catch (error) {
        console.error('Create shared link error:', error);
        return null;
      }
    },

    updateSharedLink: async (linkId, updates) => {
      try {
        await apiCall(`/sharing/${linkId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        
        await get().loadSharedLinks();
        
        return true;
      } catch (error) {
        console.error('Update shared link error:', error);
        return false;
      }
    },

    deleteSharedLink: async (linkId) => {
      try {
        await apiCall(`/sharing/${linkId}`, {
          method: 'DELETE',
        });
        
        await get().loadSharedLinks();
        
        return true;
      } catch (error) {
        console.error('Delete shared link error:', error);
        return false;
      }
    },

    generateQRCode: async (linkId) => {
      try {
        const response = await apiCall(`/sharing/${linkId}/qr`);
        return response.qrCode.data;
      } catch (error) {
        console.error('Generate QR code error:', error);
        return null;
      }
    },

    // Team actions
    loadTeams: async () => {
      set({ isLoadingTeams: true });
      try {
        const response = await apiCall('/teams');
        set({ teams: response.teams });
      } catch (error) {
        console.error('Load teams error:', error);
      } finally {
        set({ isLoadingTeams: false });
      }
    },

    createTeam: async (team) => {
      try {
        const response = await apiCall('/teams', {
          method: 'POST',
          body: JSON.stringify(team),
        });
        
        await get().loadTeams();
        
        return response.team;
      } catch (error) {
        console.error('Create team error:', error);
        return null;
      }
    },

    joinTeam: async (inviteCode) => {
      try {
        await apiCall(`/teams/join/${inviteCode}`, {
          method: 'POST',
        });
        
        await get().loadTeams();
        
        return true;
      } catch (error) {
        console.error('Join team error:', error);
        return false;
      }
    },

    leaveTeam: async (teamId) => {
      const { user } = get();
      if (!user) return false;

      try {
        await apiCall(`/teams/${teamId}/members/${user.id}`, {
          method: 'DELETE',
        });
        
        await get().loadTeams();
        
        return true;
      } catch (error) {
        console.error('Leave team error:', error);
        return false;
      }
    },

    updateTeamMember: async (teamId, userId, role) => {
      try {
        await apiCall(`/teams/${teamId}/members/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
        });
        
        await get().loadTeams();
        
        return true;
      } catch (error) {
        console.error('Update team member error:', error);
        return false;
      }
    },

    // Activity actions
    loadActivity: async (projectId, teamId) => {
      set({ isLoadingActivity: true });
      try {
        let endpoint = '/activity';
        if (projectId) {
          endpoint = `/projects/${projectId}/activity`;
        } else if (teamId) {
          endpoint = `/teams/${teamId}/activity`;
        }

        const response = await apiCall(endpoint);
        set({ activityFeed: response.activities });
      } catch (error) {
        console.error('Load activity error:', error);
      } finally {
        set({ isLoadingActivity: false });
      }
    },

    // UI actions
    toggleSharingModal: (open) => {
      set({ 
        isSharingModalOpen: open !== undefined ? open : !get().isSharingModalOpen 
      });
    },

    toggleAnnotationToolbar: (visible) => {
      set({ 
        isAnnotationToolbarVisible: visible !== undefined ? visible : !get().isAnnotationToolbarVisible 
      });
    },

    toggleCollaborationSidebar: (open) => {
      set({ 
        isCollaborationSidebarOpen: open !== undefined ? open : !get().isCollaborationSidebarOpen 
      });
    },

    toggleProjectModal: (open) => {
      set({ 
        isProjectModalOpen: open !== undefined ? open : !get().isProjectModalOpen 
      });
    },

    setSelectedView: (view) => {
      set({ selectedView: view as any });
      
      // Notify other users of view change
      const { currentProject } = get();
      if (currentProject) {
        get().sendMessage({
          type: 'presence_update',
          payload: { 
            presence: { currentView: view }
          },
        });
      }
    },

    // Real-time handlers
    handleUserJoined: (user) => {
      set((state) => ({
        activeUsers: [...state.activeUsers.filter(u => u.sessionId !== user.sessionId), user]
      }));
    },

    handleUserLeft: (sessionId) => {
      set((state) => ({
        activeUsers: state.activeUsers.filter(u => u.sessionId !== sessionId)
      }));
    },

    handleCursorMove: (userId, position) => {
      set((state) => ({
        activeUsers: state.activeUsers.map(user => 
          user.id === userId 
            ? { ...user, cursorPosition: position }
            : user
        )
      }));
    },

    handleTypingStart: (userId, username, targetId, targetType) => {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        newTypingUsers.set(`${userId}-${targetId}`, {
          userId,
          username,
          targetId,
          targetType,
        });
        return { typingUsers: newTypingUsers };
      });

      // Auto-clear typing indicator after 3 seconds
      setTimeout(() => {
        get().handleTypingStop(userId);
      }, 3000);
    },

    handleTypingStop: (userId) => {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        // Remove all typing indicators for this user
        for (const [key, value] of Array.from(newTypingUsers.entries())) {
          if (value.userId === userId) {
            newTypingUsers.delete(key);
          }
        }
        return { typingUsers: newTypingUsers };
      });
    },
  }))
);

// Initialize authentication on app load
const initAuth = async () => {
  const token = localStorage.getItem('dillin_token');
  if (token) {
    useCollaboration.setState({ token });
    await useCollaboration.getState().checkAuth();
  }
};

// Call initialization
initAuth();