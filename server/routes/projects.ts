import { Router } from 'express';
import { authenticateToken, AuthRequest, requireRole } from '../auth';
import { storage } from '../storage';
import { insertProjectSchema } from '@shared/schema';

const router = Router();

// Get user's projects
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const projects = await storage.getProjectsByUser(userId);
    
    // Include collaboration info
    const projectsWithCollabs = await Promise.all(
      projects.map(async (project) => {
        const collaborators = await storage.getProjectCollaborators(project.id);
        return {
          ...project,
          collaboratorCount: collaborators.length
        };
      })
    );

    res.json({
      projects: projectsWithCollabs
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: 'Failed to fetch projects',
      code: 'FETCH_PROJECTS_ERROR'
    });
  }
});

// Get public projects (for discovery)
router.get('/public', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const allPublicProjects = await storage.getPublicProjects();
    const projects = allPublicProjects.slice(offset, offset + limit);
    
    // Include collaboration info
    const projectsWithInfo = await Promise.all(
      projects.map(async (project) => {
        const collaborators = await storage.getProjectCollaborators(project.id);
        const owner = await storage.getUser(project.ownerId);
        return {
          ...project,
          collaboratorCount: collaborators.length,
          ownerName: owner?.username || 'Unknown'
        };
      })
    );

    res.json({
      projects: projectsWithInfo,
      total: allPublicProjects.length,
      hasMore: offset + limit < allPublicProjects.length
    });
  } catch (error) {
    console.error('Get public projects error:', error);
    res.status(500).json({
      error: 'Failed to fetch public projects',
      code: 'FETCH_PUBLIC_PROJECTS_ERROR'
    });
  }
});

// Get project templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await storage.getProjectTemplates();
    
    const templatesWithInfo = await Promise.all(
      templates.map(async (template) => {
        const owner = await storage.getUser(template.ownerId);
        return {
          ...template,
          ownerName: owner?.username || 'Unknown'
        };
      })
    );

    res.json({
      templates: templatesWithInfo
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      code: 'FETCH_TEMPLATES_ERROR'
    });
  }
});

// Get specific project
router.get('/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Check if user has access (owner, collaborator, or public project)
    let hasAccess = false;
    let userRole = null;

    if (project.ownerId === userId) {
      hasAccess = true;
      userRole = 'owner';
    } else if (project.isPublic) {
      hasAccess = true;
      userRole = 'viewer';
    } else {
      userRole = await storage.getUserProjectRole(projectId, userId);
      hasAccess = userRole !== null;
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get additional project info
    const collaborators = await storage.getProjectCollaborators(projectId);
    const owner = await storage.getUser(project.ownerId);
    const activity = await storage.getProjectActivity(projectId, 10);

    res.json({
      project: {
        ...project,
        ownerName: owner?.username || 'Unknown',
        userRole,
        collaborators: collaborators.map(collab => ({
          userId: collab.userId,
          role: collab.role,
          invitedAt: collab.invitedAt,
          acceptedAt: collab.acceptedAt
        })),
        recentActivity: activity
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      error: 'Failed to fetch project',
      code: 'FETCH_PROJECT_ERROR'
    });
  }
});

// Create new project
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const projectData = req.body;

    // Validate project data
    const validationResult = insertProjectSchema.safeParse(projectData);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid project data',
        code: 'INVALID_PROJECT_DATA',
        details: validationResult.error.issues
      });
    }

    // Create project
    const project = await storage.createProject({
      ...validationResult.data,
      ownerId: userId
    });

    // Add owner as project collaborator
    await storage.addProjectCollaborator(project.id, userId, 'owner', userId);

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId: project.id,
      action: 'create',
      targetType: 'project',
      targetId: project.id,
      details: {
        event: 'project_created',
        projectTitle: project.title
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      error: 'Failed to create project',
      code: 'CREATE_PROJECT_ERROR'
    });
  }
});

// Update project
router.put('/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    const updates = req.body;

    // Check permissions (owner or editor)
    const userRole = await storage.getUserProjectRole(projectId, userId);
    const project = await storage.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const isOwner = project.ownerId === userId;
    const canEdit = isOwner || userRole === 'editor';

    if (!canEdit) {
      return res.status(403).json({
        error: 'Insufficient permissions to edit project',
        code: 'EDIT_PERMISSION_DENIED'
      });
    }

    // Update project
    const updatedProject = await storage.updateProject(projectId, {
      ...updates,
      version: (project.version || 1) + 1
    });

    if (!updatedProject) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId,
      action: 'update',
      targetType: 'project',
      targetId: projectId,
      details: {
        event: 'project_updated',
        fields: Object.keys(updates),
        version: updatedProject.version
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Project updated successfully',
      project: updatedProject
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      error: 'Failed to update project',
      code: 'UPDATE_PROJECT_ERROR'
    });
  }
});

// Delete project
router.delete('/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;

    // Check if user is owner
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    if (project.ownerId !== userId) {
      return res.status(403).json({
        error: 'Only project owner can delete project',
        code: 'DELETE_PERMISSION_DENIED'
      });
    }

    // Delete project (this will cascade delete collaborators, annotations, etc.)
    const deleted = await storage.deleteProject(projectId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      action: 'delete',
      targetType: 'project',
      targetId: projectId,
      details: {
        event: 'project_deleted',
        projectTitle: project.title
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      code: 'DELETE_PROJECT_ERROR'
    });
  }
});

// Project collaborators routes

// Get project collaborators
router.get('/:projectId/collaborators', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;

    // Check if user has access to project
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId, userId);
    const hasAccess = project.ownerId === userId || userRole !== null || project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const collaborators = await storage.getProjectCollaborators(projectId);
    
    // Get user details for each collaborator
    const collaboratorsWithDetails = await Promise.all(
      collaborators.map(async (collab) => {
        const user = await storage.getUser(collab.userId);
        const inviter = collab.invitedBy ? await storage.getUser(collab.invitedBy) : null;
        return {
          ...collab,
          username: user?.username || 'Unknown',
          fullName: user?.fullName,
          email: user?.email,
          inviterName: inviter?.username
        };
      })
    );

    res.json({
      collaborators: collaboratorsWithDetails
    });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({
      error: 'Failed to fetch collaborators',
      code: 'FETCH_COLLABORATORS_ERROR'
    });
  }
});

// Add project collaborator
router.post('/:projectId/collaborators', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { username, role = 'viewer' } = req.body;
    const userId = req.userId!;

    // Check if user can manage collaborators (owner or admin)
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId, userId);
    const canManage = project.ownerId === userId || userRole === 'admin';

    if (!canManage) {
      return res.status(403).json({
        error: 'Insufficient permissions to manage collaborators',
        code: 'MANAGE_PERMISSION_DENIED'
      });
    }

    // Find user by username
    const targetUser = await storage.getUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is already a collaborator
    const existingRole = await storage.getUserProjectRole(projectId, targetUser.id);
    if (existingRole) {
      return res.status(409).json({
        error: 'User is already a collaborator',
        code: 'ALREADY_COLLABORATOR',
        currentRole: existingRole
      });
    }

    // Add collaborator
    const collaborator = await storage.addProjectCollaborator(
      projectId,
      targetUser.id,
      role,
      userId
    );

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId,
      action: 'create',
      targetType: 'collaborator',
      targetId: `${projectId}-${targetUser.id}`,
      details: {
        event: 'collaborator_added',
        targetUsername: targetUser.username,
        role
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'Collaborator added successfully',
      collaborator: {
        ...collaborator,
        username: targetUser.username,
        fullName: targetUser.fullName
      }
    });
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({
      error: 'Failed to add collaborator',
      code: 'ADD_COLLABORATOR_ERROR'
    });
  }
});

// Update collaborator role
router.put('/:projectId/collaborators/:collaboratorUserId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, collaboratorUserId } = req.params;
    const { role } = req.body;
    const userId = req.userId!;

    // Check permissions
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId, userId);
    const canManage = project.ownerId === userId || userRole === 'admin';

    if (!canManage) {
      return res.status(403).json({
        error: 'Insufficient permissions to manage collaborators',
        code: 'MANAGE_PERMISSION_DENIED'
      });
    }

    // Update role
    const success = await storage.updateProjectCollaboratorRole(
      projectId,
      parseInt(collaboratorUserId),
      role
    );

    if (!success) {
      return res.status(404).json({
        error: 'Collaborator not found',
        code: 'COLLABORATOR_NOT_FOUND'
      });
    }

    // Get target user for logging
    const targetUser = await storage.getUser(parseInt(collaboratorUserId));

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId,
      action: 'update',
      targetType: 'collaborator',
      targetId: `${projectId}-${collaboratorUserId}`,
      details: {
        event: 'collaborator_role_updated',
        targetUsername: targetUser?.username,
        newRole: role
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Collaborator role updated successfully'
    });
  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({
      error: 'Failed to update collaborator role',
      code: 'UPDATE_COLLABORATOR_ERROR'
    });
  }
});

// Remove collaborator
router.delete('/:projectId/collaborators/:collaboratorUserId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, collaboratorUserId } = req.params;
    const userId = req.userId!;

    // Check permissions
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId, userId);
    const canManage = project.ownerId === userId || userRole === 'admin';
    const isSelfRemoval = userId === parseInt(collaboratorUserId);

    if (!canManage && !isSelfRemoval) {
      return res.status(403).json({
        error: 'Insufficient permissions to remove collaborator',
        code: 'REMOVE_PERMISSION_DENIED'
      });
    }

    // Cannot remove project owner
    if (project.ownerId === parseInt(collaboratorUserId)) {
      return res.status(400).json({
        error: 'Cannot remove project owner',
        code: 'CANNOT_REMOVE_OWNER'
      });
    }

    // Get target user for logging
    const targetUser = await storage.getUser(parseInt(collaboratorUserId));

    // Remove collaborator
    const success = await storage.removeProjectCollaborator(
      projectId,
      parseInt(collaboratorUserId)
    );

    if (!success) {
      return res.status(404).json({
        error: 'Collaborator not found',
        code: 'COLLABORATOR_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId,
      action: 'delete',
      targetType: 'collaborator',
      targetId: `${projectId}-${collaboratorUserId}`,
      details: {
        event: isSelfRemoval ? 'collaborator_left' : 'collaborator_removed',
        targetUsername: targetUser?.username
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Collaborator removed successfully'
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      error: 'Failed to remove collaborator',
      code: 'REMOVE_COLLABORATOR_ERROR'
    });
  }
});

// Get project activity
router.get('/:projectId/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user has access to project
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId, userId);
    const hasAccess = project.ownerId === userId || userRole !== null || project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const activities = await storage.getProjectActivity(projectId, limit);

    // Get user details for each activity
    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        const user = await storage.getUser(activity.userId);
        return {
          ...activity,
          username: user?.username || 'Unknown',
          metadata: undefined // Don't expose sensitive metadata
        };
      })
    );

    res.json({
      activities: activitiesWithUsers
    });
  } catch (error) {
    console.error('Get project activity error:', error);
    res.status(500).json({
      error: 'Failed to fetch project activity',
      code: 'FETCH_ACTIVITY_ERROR'
    });
  }
});

export default router;