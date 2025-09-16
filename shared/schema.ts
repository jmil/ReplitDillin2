import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  fullName: text("full_name"),
  avatar: text("avatar_url"),
  role: text("role").default("user"), // 'user', 'admin'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Research projects table
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  searchQuery: text("search_query"),
  mainPaperPmid: text("main_paper_pmid"),
  visualization: text("visualization").default("cytoscape"), // 'cytoscape', 'd3', 'timeline', 'orbit', 'universe'
  networkData: jsonb("network_data"), // Stores the complete network state
  filters: jsonb("filters"), // Stores filter settings
  clusteringConfig: jsonb("clustering_config"), // Stores clustering configuration
  isPublic: boolean("is_public").default(false),
  isTemplate: boolean("is_template").default(false),
  templateCategory: text("template_category"), // 'literature-review', 'citation-analysis', etc.
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    ownerIdx: index("projects_owner_idx").on(table.ownerId),
    publicIdx: index("projects_public_idx").on(table.isPublic),
    templateIdx: index("projects_template_idx").on(table.isTemplate),
  };
});

// Project collaborators table (many-to-many)
export const projectCollaborators = pgTable("project_collaborators", {
  id: serial("id").primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(), // 'owner', 'editor', 'viewer', 'commenter'
  invitedBy: integer("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
}, (table) => {
  return {
    projectUserIdx: index("collaborators_project_user_idx").on(table.projectId, table.userId),
    userIdx: index("collaborators_user_idx").on(table.userId),
  };
});

// Shared links table
export const sharedLinks = pgTable("shared_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  linkType: text("link_type").notNull(), // 'project', 'view', 'paper', 'cluster'
  accessLevel: text("access_level").notNull(), // 'public', 'link-only', 'team-only'
  expiresAt: timestamp("expires_at"),
  password: text("password"), // Optional password protection
  maxViews: integer("max_views"), // Optional view limit
  currentViews: integer("current_views").default(0),
  allowDownload: boolean("allow_download").default(true),
  allowComments: boolean("allow_comments").default(true),
  shareData: jsonb("share_data"), // Stores specific state being shared
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
}, (table) => {
  return {
    creatorIdx: index("shared_links_creator_idx").on(table.createdBy),
    projectIdx: index("shared_links_project_idx").on(table.projectId),
    accessIdx: index("shared_links_access_idx").on(table.accessLevel),
  };
});

// Annotations table
export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  targetType: text("target_type").notNull(), // 'paper', 'relationship', 'cluster', 'view'
  targetId: text("target_id").notNull(), // ID of the target (pmid for papers, edge id for relationships, etc.)
  annotationType: text("annotation_type").notNull(), // 'note', 'highlight', 'tag', 'comment'
  content: text("content").notNull(),
  richContent: jsonb("rich_content"), // For rich text formatting
  color: text("color"), // For highlights and tags
  position: jsonb("position"), // For positioning annotations on visualizations
  tags: text("tags").array(), // Array of tag strings
  isPrivate: boolean("is_private").default(false), // Private vs shared annotations
  parentId: uuid("parent_id").references(() => annotations.id), // For threaded comments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    projectUserIdx: index("annotations_project_user_idx").on(table.projectId, table.userId),
    targetIdx: index("annotations_target_idx").on(table.targetType, table.targetId),
    typeIdx: index("annotations_type_idx").on(table.annotationType),
    parentIdx: index("annotations_parent_idx").on(table.parentId),
  };
});

// Teams table
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(false),
  maxMembers: integer("max_members").default(50),
  inviteCode: text("invite_code").unique(), // For easy team joining
  settings: jsonb("settings"), // Team-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    ownerIdx: index("teams_owner_idx").on(table.ownerId),
    publicIdx: index("teams_public_idx").on(table.isPublic),
    inviteIdx: index("teams_invite_idx").on(table.inviteCode),
  };
});

// Team members table (many-to-many)
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(), // 'owner', 'admin', 'member'
  joinedAt: timestamp("joined_at").defaultNow(),
  invitedBy: integer("invited_by").references(() => users.id),
  lastActiveAt: timestamp("last_active_at"),
}, (table) => {
  return {
    teamUserIdx: index("team_members_team_user_idx").on(table.teamId, table.userId),
    userIdx: index("team_members_user_idx").on(table.userId),
  };
});

// Activity logs table
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'share', 'comment', 'join', 'leave'
  targetType: text("target_type").notNull(), // 'project', 'annotation', 'team', 'share'
  targetId: text("target_id"),
  details: jsonb("details"), // Additional action details
  metadata: jsonb("metadata"), // Browser, IP, etc. for security
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    userIdx: index("activity_logs_user_idx").on(table.userId),
    projectIdx: index("activity_logs_project_idx").on(table.projectId),
    teamIdx: index("activity_logs_team_idx").on(table.teamId),
    actionIdx: index("activity_logs_action_idx").on(table.action),
    createdIdx: index("activity_logs_created_idx").on(table.createdAt),
  };
});

// Real-time collaboration sessions table
export const collaborationSessions = pgTable("collaboration_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  socketId: text("socket_id").notNull(),
  currentView: text("current_view"), // Current visualization mode
  cursorPosition: jsonb("cursor_position"), // For real-time cursor tracking
  isActive: boolean("is_active").default(true),
  startedAt: timestamp("started_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
}, (table) => {
  return {
    projectUserIdx: index("collab_sessions_project_user_idx").on(table.projectId, table.userId),
    activeIdx: index("collab_sessions_active_idx").on(table.isActive),
    socketIdx: index("collab_sessions_socket_idx").on(table.socketId),
  };
});

// Export schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  title: true,
  description: true,
  searchQuery: true,
  mainPaperPmid: true,
  visualization: true,
  networkData: true,
  filters: true,
  clusteringConfig: true,
  isPublic: true,
  isTemplate: true,
  templateCategory: true,
});

export const insertAnnotationSchema = createInsertSchema(annotations).pick({
  targetType: true,
  targetId: true,
  annotationType: true,
  content: true,
  richContent: true,
  color: true,
  position: true,
  tags: true,
  isPrivate: true,
  parentId: true,
});

export const insertSharedLinkSchema = createInsertSchema(sharedLinks).pick({
  linkType: true,
  accessLevel: true,
  expiresAt: true,
  password: true,
  maxViews: true,
  allowDownload: true,
  allowComments: true,
  shareData: true,
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  description: true,
  isPublic: true,
  maxMembers: true,
  settings: true,
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type SharedLink = typeof sharedLinks.$inferSelect;
export type InsertSharedLink = z.infer<typeof insertSharedLinkSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type CollaborationSession = typeof collaborationSessions.$inferSelect;
