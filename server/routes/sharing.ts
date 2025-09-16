import { Router } from 'express';
import { authenticateToken, authenticateOptionalToken, AuthRequest } from '../auth';
import { storage } from '../storage';
import { insertSharedLinkSchema } from '@shared/schema';
import crypto from 'crypto';

const router = Router();

// Get user's shared links
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const sharedLinks = await storage.getUserSharedLinks(userId);
    
    // Get project details for each shared link
    const linksWithProjects = await Promise.all(
      sharedLinks.map(async (link) => {
        const project = link.projectId ? await storage.getProject(link.projectId) : null;
        return {
          ...link,
          projectTitle: project?.title || 'Unknown Project'
        };
      })
    );

    res.json({
      sharedLinks: linksWithProjects
    });
  } catch (error) {
    console.error('Get shared links error:', error);
    res.status(500).json({
      error: 'Failed to fetch shared links',
      code: 'FETCH_SHARED_LINKS_ERROR'
    });
  }
});

// Get project's shared links
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res) => {
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
    const hasAccess = project.ownerId === userId || userRole !== null;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const sharedLinks = await storage.getProjectSharedLinks(projectId);
    
    // Get creator details for each shared link
    const linksWithCreators = await Promise.all(
      sharedLinks.map(async (link) => {
        const creator = await storage.getUser(link.createdBy);
        return {
          ...link,
          creatorName: creator?.username || 'Unknown'
        };
      })
    );

    res.json({
      sharedLinks: linksWithCreators
    });
  } catch (error) {
    console.error('Get project shared links error:', error);
    res.status(500).json({
      error: 'Failed to fetch project shared links',
      code: 'FETCH_PROJECT_SHARED_LINKS_ERROR'
    });
  }
});

// Get shared content by link ID (public endpoint)
router.get('/:linkId', authenticateOptionalToken, async (req: AuthRequest, res) => {
  try {
    const { linkId } = req.params;
    const { password } = req.query;

    const sharedLink = await storage.getSharedLink(linkId);
    if (!sharedLink) {
      return res.status(404).json({
        error: 'Shared link not found or expired',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Check if link has expired
    if (sharedLink.expiresAt && new Date() > sharedLink.expiresAt) {
      return res.status(410).json({
        error: 'Shared link has expired',
        code: 'SHARED_LINK_EXPIRED'
      });
    }

    // Check view limit
    if (sharedLink.maxViews && sharedLink.currentViews >= sharedLink.maxViews) {
      return res.status(410).json({
        error: 'Shared link view limit exceeded',
        code: 'VIEW_LIMIT_EXCEEDED'
      });
    }

    // Check password if required
    if (sharedLink.password && password !== sharedLink.password) {
      return res.status(401).json({
        error: 'Password required',
        code: 'PASSWORD_REQUIRED',
        passwordProtected: true
      });
    }

    // Check access level permissions
    let hasAccess = false;
    let userRole = null;

    if (sharedLink.accessLevel === 'public') {
      hasAccess = true;
    } else if (sharedLink.accessLevel === 'link-only') {
      hasAccess = true;
    } else if (sharedLink.accessLevel === 'team-only' && req.userId) {
      // Check if user is part of the project team
      if (sharedLink.projectId) {
        const project = await storage.getProject(sharedLink.projectId);
        if (project) {
          userRole = await storage.getUserProjectRole(sharedLink.projectId, req.userId);
          hasAccess = project.ownerId === req.userId || userRole !== null;
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED',
        requiresAuth: sharedLink.accessLevel === 'team-only'
      });
    }

    // Increment view count
    await storage.incrementLinkViews(linkId);

    // Get project data if applicable
    let projectData = null;
    if (sharedLink.projectId) {
      const project = await storage.getProject(sharedLink.projectId);
      if (project) {
        const creator = await storage.getUser(project.ownerId);
        projectData = {
          ...project,
          creatorName: creator?.username || 'Unknown'
        };
      }
    }

    // Get creator details
    const creator = await storage.getUser(sharedLink.createdBy);

    // Log activity
    if (req.userId) {
      await storage.createActivityLog({
        userId: req.userId,
        projectId: sharedLink.projectId,
        action: 'view',
        targetType: 'share',
        targetId: linkId,
        details: {
          event: 'shared_link_accessed',
          linkType: sharedLink.linkType
        },
        metadata: {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });
    }

    res.json({
      sharedLink: {
        id: sharedLink.id,
        linkType: sharedLink.linkType,
        shareData: sharedLink.shareData,
        allowDownload: sharedLink.allowDownload,
        allowComments: sharedLink.allowComments,
        createdAt: sharedLink.createdAt,
        creatorName: creator?.username || 'Unknown',
        currentViews: sharedLink.currentViews + 1,
        maxViews: sharedLink.maxViews
      },
      project: projectData,
      userRole
    });
  } catch (error) {
    console.error('Get shared content error:', error);
    res.status(500).json({
      error: 'Failed to fetch shared content',
      code: 'FETCH_SHARED_CONTENT_ERROR'
    });
  }
});

// Create new shared link
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const linkData = req.body;

    // Validate link data
    const validationResult = insertSharedLinkSchema.safeParse(linkData);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid shared link data',
        code: 'INVALID_SHARED_LINK_DATA',
        details: validationResult.error.issues
      });
    }

    const { projectId, linkType, accessLevel } = validationResult.data;

    // Check if user has permission to share (for project links)
    if (projectId) {
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }

      const userRole = await storage.getUserProjectRole(projectId, userId);
      const canShare = project.ownerId === userId || 
                      userRole === 'editor' || 
                      userRole === 'admin';

      if (!canShare) {
        return res.status(403).json({
          error: 'Insufficient permissions to share project',
          code: 'SHARE_PERMISSION_DENIED'
        });
      }
    }

    // Create shared link
    const sharedLink = await storage.createSharedLink({
      ...validationResult.data,
      createdBy: userId
    });

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId,
      action: 'create',
      targetType: 'share',
      targetId: sharedLink.id,
      details: {
        event: 'shared_link_created',
        linkType,
        accessLevel
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'Shared link created successfully',
      sharedLink: {
        id: sharedLink.id,
        linkType: sharedLink.linkType,
        accessLevel: sharedLink.accessLevel,
        expiresAt: sharedLink.expiresAt,
        maxViews: sharedLink.maxViews,
        createdAt: sharedLink.createdAt,
        url: `${req.protocol}://${req.get('host')}/share/${sharedLink.id}`
      }
    });
  } catch (error) {
    console.error('Create shared link error:', error);
    res.status(500).json({
      error: 'Failed to create shared link',
      code: 'CREATE_SHARED_LINK_ERROR'
    });
  }
});

// Update shared link
router.put('/:linkId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;
    const updates = req.body;

    const sharedLink = await storage.getSharedLink(linkId);
    if (!sharedLink) {
      return res.status(404).json({
        error: 'Shared link not found',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Check if user can update (creator or project owner)
    let canUpdate = sharedLink.createdBy === userId;
    
    if (!canUpdate && sharedLink.projectId) {
      const project = await storage.getProject(sharedLink.projectId);
      canUpdate = project?.ownerId === userId;
    }

    if (!canUpdate) {
      return res.status(403).json({
        error: 'Insufficient permissions to update shared link',
        code: 'UPDATE_SHARE_PERMISSION_DENIED'
      });
    }

    // Update shared link
    const updatedLink = await storage.updateSharedLink(linkId, updates);
    if (!updatedLink) {
      return res.status(404).json({
        error: 'Shared link not found',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId: sharedLink.projectId,
      action: 'update',
      targetType: 'share',
      targetId: linkId,
      details: {
        event: 'shared_link_updated',
        fields: Object.keys(updates)
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Shared link updated successfully',
      sharedLink: updatedLink
    });
  } catch (error) {
    console.error('Update shared link error:', error);
    res.status(500).json({
      error: 'Failed to update shared link',
      code: 'UPDATE_SHARED_LINK_ERROR'
    });
  }
});

// Delete shared link
router.delete('/:linkId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;

    const sharedLink = await storage.getSharedLink(linkId);
    if (!sharedLink) {
      return res.status(404).json({
        error: 'Shared link not found',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Check if user can delete (creator or project owner)
    let canDelete = sharedLink.createdBy === userId;
    
    if (!canDelete && sharedLink.projectId) {
      const project = await storage.getProject(sharedLink.projectId);
      canDelete = project?.ownerId === userId;
    }

    if (!canDelete) {
      return res.status(403).json({
        error: 'Insufficient permissions to delete shared link',
        code: 'DELETE_SHARE_PERMISSION_DENIED'
      });
    }

    // Delete shared link
    const deleted = await storage.deleteSharedLink(linkId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Shared link not found',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId: sharedLink.projectId,
      action: 'delete',
      targetType: 'share',
      targetId: linkId,
      details: {
        event: 'shared_link_deleted',
        linkType: sharedLink.linkType
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Shared link deleted successfully'
    });
  } catch (error) {
    console.error('Delete shared link error:', error);
    res.status(500).json({
      error: 'Failed to delete shared link',
      code: 'DELETE_SHARED_LINK_ERROR'
    });
  }
});

// Generate QR code for shared link
router.get('/:linkId/qr', async (req, res) => {
  try {
    const { linkId } = req.params;
    const size = parseInt(req.query.size as string) || 200;

    const sharedLink = await storage.getSharedLink(linkId);
    if (!sharedLink) {
      return res.status(404).json({
        error: 'Shared link not found',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Create the share URL
    const shareUrl = `${req.protocol}://${req.get('host')}/share/${linkId}`;

    // Generate a simple QR code response (in production, use a proper QR code library)
    res.json({
      qrCode: {
        url: shareUrl,
        size,
        format: 'svg',
        // In production, generate actual QR code data here
        data: `data:image/svg+xml;base64,${Buffer.from(`
          <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${size}" height="${size}" fill="white"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12">
              QR Code for ${shareUrl}
            </text>
          </svg>
        `).toString('base64')}`
      }
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({
      error: 'Failed to generate QR code',
      code: 'QR_CODE_ERROR'
    });
  }
});

// Get sharing analytics
router.get('/:linkId/analytics', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;

    const sharedLink = await storage.getSharedLink(linkId);
    if (!sharedLink) {
      return res.status(404).json({
        error: 'Shared link not found',
        code: 'SHARED_LINK_NOT_FOUND'
      });
    }

    // Check if user can view analytics (creator or project owner)
    let canView = sharedLink.createdBy === userId;
    
    if (!canView && sharedLink.projectId) {
      const project = await storage.getProject(sharedLink.projectId);
      canView = project?.ownerId === userId;
    }

    if (!canView) {
      return res.status(403).json({
        error: 'Insufficient permissions to view analytics',
        code: 'VIEW_ANALYTICS_PERMISSION_DENIED'
      });
    }

    // Get activity logs for this shared link
    const activities = await storage.getProjectActivity(
      sharedLink.projectId || '',
      100
    );

    const shareActivities = activities.filter(activity => 
      activity.targetType === 'share' && activity.targetId === linkId
    );

    const analytics = {
      totalViews: sharedLink.currentViews,
      maxViews: sharedLink.maxViews,
      createdAt: sharedLink.createdAt,
      lastAccessedAt: sharedLink.lastAccessedAt,
      expiresAt: sharedLink.expiresAt,
      viewHistory: shareActivities.map(activity => ({
        timestamp: activity.createdAt,
        action: activity.action,
        details: activity.details
      }))
    };

    res.json({
      analytics
    });
  } catch (error) {
    console.error('Get sharing analytics error:', error);
    res.status(500).json({
      error: 'Failed to fetch sharing analytics',
      code: 'FETCH_ANALYTICS_ERROR'
    });
  }
});

export default router;