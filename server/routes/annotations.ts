import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../auth';
import { storage } from '../storage';
import { insertAnnotationSchema } from '@shared/schema';

const router = Router();

// Get annotations for a project
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    const includePrivate = req.query.includePrivate === 'true';

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

    // Get all project annotations
    let annotations = await storage.getProjectAnnotations(projectId);

    // Filter based on privacy settings
    if (!includePrivate || project.ownerId !== userId) {
      annotations = annotations.filter(annotation => 
        !annotation.isPrivate || annotation.userId === userId
      );
    }

    // Get user details for each annotation
    const annotationsWithUsers = await Promise.all(
      annotations.map(async (annotation) => {
        const user = await storage.getUser(annotation.userId);
        return {
          ...annotation,
          username: user?.username || 'Unknown',
          userFullName: user?.fullName
        };
      })
    );

    res.json({
      annotations: annotationsWithUsers
    });
  } catch (error) {
    console.error('Get project annotations error:', error);
    res.status(500).json({
      error: 'Failed to fetch annotations',
      code: 'FETCH_ANNOTATIONS_ERROR'
    });
  }
});

// Get user's annotations across projects
router.get('/user', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.projectId as string;
    const limit = parseInt(req.query.limit as string) || 100;

    const annotations = await storage.getUserAnnotations(userId, projectId);
    
    // Get project titles for each annotation
    const annotationsWithProjects = await Promise.all(
      annotations.slice(0, limit).map(async (annotation) => {
        const project = await storage.getProject(annotation.projectId);
        return {
          ...annotation,
          projectTitle: project?.title || 'Unknown Project'
        };
      })
    );

    res.json({
      annotations: annotationsWithProjects
    });
  } catch (error) {
    console.error('Get user annotations error:', error);
    res.status(500).json({
      error: 'Failed to fetch user annotations',
      code: 'FETCH_USER_ANNOTATIONS_ERROR'
    });
  }
});

// Get specific annotation
router.get('/:annotationId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { annotationId } = req.params;
    const userId = req.userId!;

    const annotation = await storage.getAnnotation(annotationId);
    if (!annotation) {
      return res.status(404).json({
        error: 'Annotation not found',
        code: 'ANNOTATION_NOT_FOUND'
      });
    }

    // Check if user has access (annotation owner, project member, or public project)
    const project = await storage.getProject(annotation.projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(annotation.projectId, userId);
    const hasAccess = annotation.userId === userId || 
                     project.ownerId === userId || 
                     userRole !== null || 
                     (project.isPublic && !annotation.isPrivate);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get user details
    const user = await storage.getUser(annotation.userId);

    res.json({
      annotation: {
        ...annotation,
        username: user?.username || 'Unknown',
        userFullName: user?.fullName,
        projectTitle: project.title
      }
    });
  } catch (error) {
    console.error('Get annotation error:', error);
    res.status(500).json({
      error: 'Failed to fetch annotation',
      code: 'FETCH_ANNOTATION_ERROR'
    });
  }
});

// Create new annotation
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const annotationData = req.body;

    // Validate annotation data
    const validationResult = insertAnnotationSchema.safeParse(annotationData);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid annotation data',
        code: 'INVALID_ANNOTATION_DATA',
        details: validationResult.error.issues
      });
    }

    const { projectId, targetType, targetId, annotationType, content } = validationResult.data;

    // Check if user has access to the project
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId, userId);
    const canAnnotate = project.ownerId === userId || 
                       userRole === 'editor' || 
                       userRole === 'commenter' ||
                       (project.isPublic && userRole === 'viewer');

    if (!canAnnotate) {
      return res.status(403).json({
        error: 'Insufficient permissions to create annotations',
        code: 'ANNOTATION_PERMISSION_DENIED'
      });
    }

    // Create annotation
    const annotation = await storage.createAnnotation({
      ...validationResult.data,
      userId
    });

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId,
      action: 'create',
      targetType: 'annotation',
      targetId: annotation.id,
      details: {
        event: 'annotation_created',
        annotationType,
        targetType,
        targetId
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'Annotation created successfully',
      annotation
    });
  } catch (error) {
    console.error('Create annotation error:', error);
    res.status(500).json({
      error: 'Failed to create annotation',
      code: 'CREATE_ANNOTATION_ERROR'
    });
  }
});

// Update annotation
router.put('/:annotationId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { annotationId } = req.params;
    const userId = req.userId!;
    const updates = req.body;

    const annotation = await storage.getAnnotation(annotationId);
    if (!annotation) {
      return res.status(404).json({
        error: 'Annotation not found',
        code: 'ANNOTATION_NOT_FOUND'
      });
    }

    // Check if user can edit (annotation owner or project owner)
    const project = await storage.getProject(annotation.projectId);
    const canEdit = annotation.userId === userId || 
                   (project && project.ownerId === userId);

    if (!canEdit) {
      return res.status(403).json({
        error: 'Insufficient permissions to edit annotation',
        code: 'EDIT_ANNOTATION_PERMISSION_DENIED'
      });
    }

    // Update annotation
    const updatedAnnotation = await storage.updateAnnotation(annotationId, updates);
    if (!updatedAnnotation) {
      return res.status(404).json({
        error: 'Annotation not found',
        code: 'ANNOTATION_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId: annotation.projectId,
      action: 'update',
      targetType: 'annotation',
      targetId: annotationId,
      details: {
        event: 'annotation_updated',
        fields: Object.keys(updates)
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Annotation updated successfully',
      annotation: updatedAnnotation
    });
  } catch (error) {
    console.error('Update annotation error:', error);
    res.status(500).json({
      error: 'Failed to update annotation',
      code: 'UPDATE_ANNOTATION_ERROR'
    });
  }
});

// Delete annotation
router.delete('/:annotationId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { annotationId } = req.params;
    const userId = req.userId!;

    const annotation = await storage.getAnnotation(annotationId);
    if (!annotation) {
      return res.status(404).json({
        error: 'Annotation not found',
        code: 'ANNOTATION_NOT_FOUND'
      });
    }

    // Check if user can delete (annotation owner or project owner)
    const project = await storage.getProject(annotation.projectId);
    const canDelete = annotation.userId === userId || 
                     (project && project.ownerId === userId);

    if (!canDelete) {
      return res.status(403).json({
        error: 'Insufficient permissions to delete annotation',
        code: 'DELETE_ANNOTATION_PERMISSION_DENIED'
      });
    }

    // Delete annotation
    const deleted = await storage.deleteAnnotation(annotationId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Annotation not found',
        code: 'ANNOTATION_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      projectId: annotation.projectId,
      action: 'delete',
      targetType: 'annotation',
      targetId: annotationId,
      details: {
        event: 'annotation_deleted',
        annotationType: annotation.annotationType
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Annotation deleted successfully'
    });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({
      error: 'Failed to delete annotation',
      code: 'DELETE_ANNOTATION_ERROR'
    });
  }
});

// Get annotations by target (for a specific paper, relationship, etc.)
router.get('/target/:targetType/:targetId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { targetType, targetId } = req.params;
    const { projectId } = req.query;
    const userId = req.userId!;

    if (!projectId) {
      return res.status(400).json({
        error: 'Project ID is required',
        code: 'MISSING_PROJECT_ID'
      });
    }

    // Check if user has access to project
    const project = await storage.getProject(projectId as string);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(projectId as string, userId);
    const hasAccess = project.ownerId === userId || userRole !== null || project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get all project annotations and filter by target
    const allAnnotations = await storage.getProjectAnnotations(projectId as string);
    const targetAnnotations = allAnnotations.filter(annotation => 
      annotation.targetType === targetType && 
      annotation.targetId === targetId &&
      (!annotation.isPrivate || annotation.userId === userId)
    );

    // Get user details for each annotation
    const annotationsWithUsers = await Promise.all(
      targetAnnotations.map(async (annotation) => {
        const user = await storage.getUser(annotation.userId);
        return {
          ...annotation,
          username: user?.username || 'Unknown',
          userFullName: user?.fullName
        };
      })
    );

    res.json({
      annotations: annotationsWithUsers
    });
  } catch (error) {
    console.error('Get target annotations error:', error);
    res.status(500).json({
      error: 'Failed to fetch target annotations',
      code: 'FETCH_TARGET_ANNOTATIONS_ERROR'
    });
  }
});

// Get annotation replies/comments
router.get('/:annotationId/replies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { annotationId } = req.params;
    const userId = req.userId!;

    // Get parent annotation
    const parentAnnotation = await storage.getAnnotation(annotationId);
    if (!parentAnnotation) {
      return res.status(404).json({
        error: 'Annotation not found',
        code: 'ANNOTATION_NOT_FOUND'
      });
    }

    // Check access to project
    const project = await storage.getProject(parentAnnotation.projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserProjectRole(parentAnnotation.projectId, userId);
    const hasAccess = parentAnnotation.userId === userId || 
                     project.ownerId === userId || 
                     userRole !== null || 
                     (project.isPublic && !parentAnnotation.isPrivate);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get all project annotations and filter for replies
    const allAnnotations = await storage.getProjectAnnotations(parentAnnotation.projectId);
    const replies = allAnnotations.filter(annotation => 
      annotation.parentId === annotationId &&
      (!annotation.isPrivate || annotation.userId === userId)
    );

    // Get user details for each reply
    const repliesWithUsers = await Promise.all(
      replies.map(async (reply) => {
        const user = await storage.getUser(reply.userId);
        return {
          ...reply,
          username: user?.username || 'Unknown',
          userFullName: user?.fullName
        };
      })
    );

    res.json({
      replies: repliesWithUsers
    });
  } catch (error) {
    console.error('Get annotation replies error:', error);
    res.status(500).json({
      error: 'Failed to fetch annotation replies',
      code: 'FETCH_REPLIES_ERROR'
    });
  }
});

export default router;