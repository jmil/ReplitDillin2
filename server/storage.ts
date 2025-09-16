import { 
  users, 
  projects,
  annotations,
  sharedLinks,
  teams,
  teamMembers,
  projectCollaborators,
  activityLogs,
  collaborationSessions,
  type User, 
  type InsertUser,
  type Project,
  type InsertProject,
  type Annotation,
  type InsertAnnotation,
  type SharedLink,
  type InsertSharedLink,
  type Team,
  type InsertTeam,
  type TeamMember,
  type ProjectCollaborator,
  type ActivityLog,
  type CollaborationSession
} from "@shared/schema";

// Storage interface with all CRUD methods for collaboration features
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Project operations
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByUser(userId: number): Promise<Project[]>;
  getPublicProjects(): Promise<Project[]>;
  getProjectTemplates(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Project collaboration operations
  getProjectCollaborators(projectId: string): Promise<ProjectCollaborator[]>;
  addProjectCollaborator(projectId: string, userId: number, role: string, invitedBy: number): Promise<ProjectCollaborator>;
  updateProjectCollaboratorRole(projectId: string, userId: number, role: string): Promise<boolean>;
  removeProjectCollaborator(projectId: string, userId: number): Promise<boolean>;
  getUserProjectRole(projectId: string, userId: number): Promise<string | null>;
  
  // Annotation operations
  getAnnotation(id: string): Promise<Annotation | undefined>;
  getProjectAnnotations(projectId: string): Promise<Annotation[]>;
  getUserAnnotations(userId: number, projectId?: string): Promise<Annotation[]>;
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  updateAnnotation(id: string, updates: Partial<Annotation>): Promise<Annotation | undefined>;
  deleteAnnotation(id: string): Promise<boolean>;
  
  // Shared link operations
  getSharedLink(id: string): Promise<SharedLink | undefined>;
  getProjectSharedLinks(projectId: string): Promise<SharedLink[]>;
  getUserSharedLinks(userId: number): Promise<SharedLink[]>;
  createSharedLink(link: InsertSharedLink): Promise<SharedLink>;
  updateSharedLink(id: string, updates: Partial<SharedLink>): Promise<SharedLink | undefined>;
  deleteSharedLink(id: string): Promise<boolean>;
  incrementLinkViews(id: string): Promise<boolean>;
  
  // Team operations
  getTeam(id: string): Promise<Team | undefined>;
  getTeamByInviteCode(code: string): Promise<Team | undefined>;
  getUserTeams(userId: number): Promise<Team[]>;
  getPublicTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<boolean>;
  
  // Team member operations
  getTeamMembers(teamId: string): Promise<TeamMember[]>;
  addTeamMember(teamId: string, userId: number, role: string, invitedBy?: number): Promise<TeamMember>;
  updateTeamMemberRole(teamId: string, userId: number, role: string): Promise<boolean>;
  removeTeamMember(teamId: string, userId: number): Promise<boolean>;
  getUserTeamRole(teamId: string, userId: number): Promise<string | null>;
  
  // Activity log operations
  createActivityLog(log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog>;
  getProjectActivity(projectId: string, limit?: number): Promise<ActivityLog[]>;
  getUserActivity(userId: number, limit?: number): Promise<ActivityLog[]>;
  getTeamActivity(teamId: string, limit?: number): Promise<ActivityLog[]>;
  
  // Collaboration session operations
  createCollaborationSession(session: Omit<CollaborationSession, 'id' | 'startedAt' | 'lastSeenAt'>): Promise<CollaborationSession>;
  updateCollaborationSession(id: string, updates: Partial<CollaborationSession>): Promise<CollaborationSession | undefined>;
  getProjectActiveSessions(projectId: string): Promise<CollaborationSession[]>;
  endCollaborationSession(id: string): Promise<boolean>;
  cleanupInactiveSessions(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<string, Project>;
  private annotations: Map<string, Annotation>;
  private sharedLinks: Map<string, SharedLink>;
  private teams: Map<string, Team>;
  private teamMembers: Map<string, TeamMember>;
  private projectCollaborators: Map<string, ProjectCollaborator>;
  private activityLogs: ActivityLog[];
  private collaborationSessions: Map<string, CollaborationSession>;
  
  private currentUserId: number;
  private logIdCounter: number;
  private memberIdCounter: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.annotations = new Map();
    this.sharedLinks = new Map();
    this.teams = new Map();
    this.teamMembers = new Map();
    this.projectCollaborators = new Map();
    this.activityLogs = [];
    this.collaborationSessions = new Map();
    
    this.currentUserId = 1;
    this.logIdCounter = 1;
    this.memberIdCounter = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      role: 'user',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Project operations
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByUser(userId: number): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      project => project.ownerId === userId
    );
  }

  async getPublicProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      project => project.isPublic
    );
  }

  async getProjectTemplates(): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      project => project.isTemplate
    );
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newProject: Project = {
      ...project,
      id,
      version: 1,
      isPublic: false,
      isTemplate: false,
      createdAt: now,
      updatedAt: now
    };
    this.projects.set(id, newProject);
    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, ...updates, updatedAt: new Date() };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Project collaboration operations
  async getProjectCollaborators(projectId: string): Promise<ProjectCollaborator[]> {
    return Array.from(this.projectCollaborators.values()).filter(
      collab => collab.projectId === projectId
    );
  }

  async addProjectCollaborator(projectId: string, userId: number, role: string, invitedBy: number): Promise<ProjectCollaborator> {
    const id = this.memberIdCounter++;
    const now = new Date();
    const collaborator: ProjectCollaborator = {
      id,
      projectId,
      userId,
      role,
      invitedBy,
      invitedAt: now,
      acceptedAt: now,
      lastAccessedAt: null
    };
    this.projectCollaborators.set(`${projectId}-${userId}`, collaborator);
    return collaborator;
  }

  async updateProjectCollaboratorRole(projectId: string, userId: number, role: string): Promise<boolean> {
    const key = `${projectId}-${userId}`;
    const collaborator = this.projectCollaborators.get(key);
    if (!collaborator) return false;
    
    collaborator.role = role;
    this.projectCollaborators.set(key, collaborator);
    return true;
  }

  async removeProjectCollaborator(projectId: string, userId: number): Promise<boolean> {
    return this.projectCollaborators.delete(`${projectId}-${userId}`);
  }

  async getUserProjectRole(projectId: string, userId: number): Promise<string | null> {
    const collaborator = this.projectCollaborators.get(`${projectId}-${userId}`);
    return collaborator?.role || null;
  }

  // Annotation operations
  async getAnnotation(id: string): Promise<Annotation | undefined> {
    return this.annotations.get(id);
  }

  async getProjectAnnotations(projectId: string): Promise<Annotation[]> {
    return Array.from(this.annotations.values()).filter(
      annotation => annotation.projectId === projectId
    );
  }

  async getUserAnnotations(userId: number, projectId?: string): Promise<Annotation[]> {
    return Array.from(this.annotations.values()).filter(
      annotation => annotation.userId === userId && 
      (!projectId || annotation.projectId === projectId)
    );
  }

  async createAnnotation(annotation: InsertAnnotation): Promise<Annotation> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newAnnotation: Annotation = {
      ...annotation,
      id,
      isPrivate: false,
      createdAt: now,
      updatedAt: now
    };
    this.annotations.set(id, newAnnotation);
    return newAnnotation;
  }

  async updateAnnotation(id: string, updates: Partial<Annotation>): Promise<Annotation | undefined> {
    const annotation = this.annotations.get(id);
    if (!annotation) return undefined;
    
    const updatedAnnotation = { ...annotation, ...updates, updatedAt: new Date() };
    this.annotations.set(id, updatedAnnotation);
    return updatedAnnotation;
  }

  async deleteAnnotation(id: string): Promise<boolean> {
    return this.annotations.delete(id);
  }

  // Shared link operations
  async getSharedLink(id: string): Promise<SharedLink | undefined> {
    return this.sharedLinks.get(id);
  }

  async getProjectSharedLinks(projectId: string): Promise<SharedLink[]> {
    return Array.from(this.sharedLinks.values()).filter(
      link => link.projectId === projectId
    );
  }

  async getUserSharedLinks(userId: number): Promise<SharedLink[]> {
    return Array.from(this.sharedLinks.values()).filter(
      link => link.createdBy === userId
    );
  }

  async createSharedLink(link: InsertSharedLink): Promise<SharedLink> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newLink: SharedLink = {
      ...link,
      id,
      currentViews: 0,
      allowDownload: true,
      allowComments: true,
      createdAt: now,
      lastAccessedAt: null
    };
    this.sharedLinks.set(id, newLink);
    return newLink;
  }

  async updateSharedLink(id: string, updates: Partial<SharedLink>): Promise<SharedLink | undefined> {
    const link = this.sharedLinks.get(id);
    if (!link) return undefined;
    
    const updatedLink = { ...link, ...updates };
    this.sharedLinks.set(id, updatedLink);
    return updatedLink;
  }

  async deleteSharedLink(id: string): Promise<boolean> {
    return this.sharedLinks.delete(id);
  }

  async incrementLinkViews(id: string): Promise<boolean> {
    const link = this.sharedLinks.get(id);
    if (!link) return false;
    
    link.currentViews = (link.currentViews || 0) + 1;
    link.lastAccessedAt = new Date();
    this.sharedLinks.set(id, link);
    return true;
  }

  // Team operations
  async getTeam(id: string): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async getTeamByInviteCode(code: string): Promise<Team | undefined> {
    return Array.from(this.teams.values()).find(
      team => team.inviteCode === code
    );
  }

  async getUserTeams(userId: number): Promise<Team[]> {
    const userTeamIds = Array.from(this.teamMembers.values())
      .filter(member => member.userId === userId)
      .map(member => member.teamId);
    
    return Array.from(this.teams.values()).filter(
      team => userTeamIds.includes(team.id)
    );
  }

  async getPublicTeams(): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(
      team => team.isPublic
    );
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newTeam: Team = {
      ...team,
      id,
      isPublic: false,
      maxMembers: 50,
      inviteCode: Math.random().toString(36).substring(2, 15),
      createdAt: now,
      updatedAt: now
    };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const team = this.teams.get(id);
    if (!team) return undefined;
    
    const updatedTeam = { ...team, ...updates, updatedAt: new Date() };
    this.teams.set(id, updatedTeam);
    return updatedTeam;
  }

  async deleteTeam(id: string): Promise<boolean> {
    return this.teams.delete(id);
  }

  // Team member operations
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values()).filter(
      member => member.teamId === teamId
    );
  }

  async addTeamMember(teamId: string, userId: number, role: string, invitedBy?: number): Promise<TeamMember> {
    const id = this.memberIdCounter++;
    const now = new Date();
    const member: TeamMember = {
      id,
      teamId,
      userId,
      role,
      joinedAt: now,
      invitedBy,
      lastActiveAt: null
    };
    this.teamMembers.set(`${teamId}-${userId}`, member);
    return member;
  }

  async updateTeamMemberRole(teamId: string, userId: number, role: string): Promise<boolean> {
    const key = `${teamId}-${userId}`;
    const member = this.teamMembers.get(key);
    if (!member) return false;
    
    member.role = role;
    this.teamMembers.set(key, member);
    return true;
  }

  async removeTeamMember(teamId: string, userId: number): Promise<boolean> {
    return this.teamMembers.delete(`${teamId}-${userId}`);
  }

  async getUserTeamRole(teamId: string, userId: number): Promise<string | null> {
    const member = this.teamMembers.get(`${teamId}-${userId}`);
    return member?.role || null;
  }

  // Activity log operations
  async createActivityLog(log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    const id = this.logIdCounter++;
    const newLog: ActivityLog = {
      ...log,
      id,
      createdAt: new Date()
    };
    this.activityLogs.push(newLog);
    return newLog;
  }

  async getProjectActivity(projectId: string, limit: number = 50): Promise<ActivityLog[]> {
    return this.activityLogs
      .filter(log => log.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getUserActivity(userId: number, limit: number = 50): Promise<ActivityLog[]> {
    return this.activityLogs
      .filter(log => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getTeamActivity(teamId: string, limit: number = 50): Promise<ActivityLog[]> {
    return this.activityLogs
      .filter(log => log.teamId === teamId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Collaboration session operations
  async createCollaborationSession(session: Omit<CollaborationSession, 'id' | 'startedAt' | 'lastSeenAt'>): Promise<CollaborationSession> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newSession: CollaborationSession = {
      ...session,
      id,
      isActive: true,
      startedAt: now,
      lastSeenAt: now
    };
    this.collaborationSessions.set(id, newSession);
    return newSession;
  }

  async updateCollaborationSession(id: string, updates: Partial<CollaborationSession>): Promise<CollaborationSession | undefined> {
    const session = this.collaborationSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates, lastSeenAt: new Date() };
    this.collaborationSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getProjectActiveSessions(projectId: string): Promise<CollaborationSession[]> {
    return Array.from(this.collaborationSessions.values()).filter(
      session => session.projectId === projectId && session.isActive
    );
  }

  async endCollaborationSession(id: string): Promise<boolean> {
    const session = this.collaborationSessions.get(id);
    if (!session) return false;
    
    session.isActive = false;
    this.collaborationSessions.set(id, session);
    return true;
  }

  async cleanupInactiveSessions(): Promise<number> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let cleaned = 0;
    
    for (const [id, session] of this.collaborationSessions.entries()) {
      if (session.lastSeenAt < thirtyMinutesAgo) {
        session.isActive = false;
        this.collaborationSessions.set(id, session);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

export const storage = new MemStorage();
