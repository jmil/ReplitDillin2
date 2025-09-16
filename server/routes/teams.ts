import { Router } from 'express';
import { authenticateToken, AuthRequest, generateRandomString } from '../auth';
import { storage } from '../storage';
import { insertTeamSchema } from '@shared/schema';

const router = Router();

// Get user's teams
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const teams = await storage.getUserTeams(userId);
    
    // Get member counts and user roles for each team
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        const members = await storage.getTeamMembers(team.id);
        const userRole = await storage.getUserTeamRole(team.id, userId);
        return {
          ...team,
          memberCount: members.length,
          userRole
        };
      })
    );

    res.json({
      teams: teamsWithDetails
    });
  } catch (error) {
    console.error('Get user teams error:', error);
    res.status(500).json({
      error: 'Failed to fetch teams',
      code: 'FETCH_TEAMS_ERROR'
    });
  }
});

// Get public teams (for discovery)
router.get('/public', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const allPublicTeams = await storage.getPublicTeams();
    const teams = allPublicTeams.slice(offset, offset + limit);
    
    // Get team details
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        const members = await storage.getTeamMembers(team.id);
        const owner = await storage.getUser(team.ownerId);
        return {
          ...team,
          memberCount: members.length,
          ownerName: owner?.username || 'Unknown'
        };
      })
    );

    res.json({
      teams: teamsWithDetails,
      total: allPublicTeams.length,
      hasMore: offset + limit < allPublicTeams.length
    });
  } catch (error) {
    console.error('Get public teams error:', error);
    res.status(500).json({
      error: 'Failed to fetch public teams',
      code: 'FETCH_PUBLIC_TEAMS_ERROR'
    });
  }
});

// Get specific team
router.get('/:teamId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId!;
    
    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check if user has access (member or public team)
    const userRole = await storage.getUserTeamRole(teamId, userId);
    const hasAccess = userRole !== null || team.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get team details
    const members = await storage.getTeamMembers(teamId);
    const owner = await storage.getUser(team.ownerId);
    const activity = await storage.getTeamActivity(teamId, 10);

    // Get member details
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await storage.getUser(member.userId);
        const inviter = member.invitedBy ? await storage.getUser(member.invitedBy) : null;
        return {
          ...member,
          username: user?.username || 'Unknown',
          fullName: user?.fullName,
          email: user?.email,
          inviterName: inviter?.username
        };
      })
    );

    res.json({
      team: {
        ...team,
        ownerName: owner?.username || 'Unknown',
        userRole,
        members: membersWithDetails,
        recentActivity: activity
      }
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      error: 'Failed to fetch team',
      code: 'FETCH_TEAM_ERROR'
    });
  }
});

// Create new team
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const teamData = req.body;

    // Validate team data
    const validationResult = insertTeamSchema.safeParse(teamData);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid team data',
        code: 'INVALID_TEAM_DATA',
        details: validationResult.error.issues
      });
    }

    // Create team
    const team = await storage.createTeam({
      ...validationResult.data,
      ownerId: userId
    });

    // Add owner as team member
    await storage.addTeamMember(team.id, userId, 'owner');

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId: team.id,
      action: 'create',
      targetType: 'team',
      targetId: team.id,
      details: {
        event: 'team_created',
        teamName: team.name
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'Team created successfully',
      team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      error: 'Failed to create team',
      code: 'CREATE_TEAM_ERROR'
    });
  }
});

// Update team
router.put('/:teamId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId!;
    const updates = req.body;

    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check permissions (owner or admin)
    const userRole = await storage.getUserTeamRole(teamId, userId);
    const canEdit = team.ownerId === userId || userRole === 'admin';

    if (!canEdit) {
      return res.status(403).json({
        error: 'Insufficient permissions to edit team',
        code: 'EDIT_TEAM_PERMISSION_DENIED'
      });
    }

    // Update team
    const updatedTeam = await storage.updateTeam(teamId, updates);
    if (!updatedTeam) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId,
      action: 'update',
      targetType: 'team',
      targetId: teamId,
      details: {
        event: 'team_updated',
        fields: Object.keys(updates)
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Team updated successfully',
      team: updatedTeam
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      error: 'Failed to update team',
      code: 'UPDATE_TEAM_ERROR'
    });
  }
});

// Delete team
router.delete('/:teamId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId!;

    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Only team owner can delete team
    if (team.ownerId !== userId) {
      return res.status(403).json({
        error: 'Only team owner can delete team',
        code: 'DELETE_TEAM_PERMISSION_DENIED'
      });
    }

    // Delete team (this will cascade delete members)
    const deleted = await storage.deleteTeam(teamId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      action: 'delete',
      targetType: 'team',
      targetId: teamId,
      details: {
        event: 'team_deleted',
        teamName: team.name
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      error: 'Failed to delete team',
      code: 'DELETE_TEAM_ERROR'
    });
  }
});

// Team member management routes

// Get team members
router.get('/:teamId/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId!;

    // Check if user has access to team
    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserTeamRole(teamId, userId);
    const hasAccess = userRole !== null || team.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const members = await storage.getTeamMembers(teamId);
    
    // Get user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await storage.getUser(member.userId);
        const inviter = member.invitedBy ? await storage.getUser(member.invitedBy) : null;
        return {
          ...member,
          username: user?.username || 'Unknown',
          fullName: user?.fullName,
          email: user?.email,
          inviterName: inviter?.username
        };
      })
    );

    res.json({
      members: membersWithDetails
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      error: 'Failed to fetch team members',
      code: 'FETCH_MEMBERS_ERROR'
    });
  }
});

// Add team member
router.post('/:teamId/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const { username, role = 'member' } = req.body;
    const userId = req.userId!;

    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check permissions (owner or admin)
    const userRole = await storage.getUserTeamRole(teamId, userId);
    const canManage = team.ownerId === userId || userRole === 'admin';

    if (!canManage) {
      return res.status(403).json({
        error: 'Insufficient permissions to manage members',
        code: 'MANAGE_MEMBERS_PERMISSION_DENIED'
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

    // Check if user is already a member
    const existingRole = await storage.getUserTeamRole(teamId, targetUser.id);
    if (existingRole) {
      return res.status(409).json({
        error: 'User is already a team member',
        code: 'ALREADY_MEMBER',
        currentRole: existingRole
      });
    }

    // Check team member limit
    const currentMembers = await storage.getTeamMembers(teamId);
    if (currentMembers.length >= team.maxMembers) {
      return res.status(400).json({
        error: 'Team has reached maximum member limit',
        code: 'MEMBER_LIMIT_REACHED',
        maxMembers: team.maxMembers
      });
    }

    // Add member
    const member = await storage.addTeamMember(teamId, targetUser.id, role, userId);

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId,
      action: 'create',
      targetType: 'member',
      targetId: `${teamId}-${targetUser.id}`,
      details: {
        event: 'member_added',
        targetUsername: targetUser.username,
        role
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'Team member added successfully',
      member: {
        ...member,
        username: targetUser.username,
        fullName: targetUser.fullName
      }
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({
      error: 'Failed to add team member',
      code: 'ADD_MEMBER_ERROR'
    });
  }
});

// Update member role
router.put('/:teamId/members/:memberUserId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId, memberUserId } = req.params;
    const { role } = req.body;
    const userId = req.userId!;

    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check permissions (owner or admin)
    const userRole = await storage.getUserTeamRole(teamId, userId);
    const canManage = team.ownerId === userId || userRole === 'admin';

    if (!canManage) {
      return res.status(403).json({
        error: 'Insufficient permissions to manage members',
        code: 'MANAGE_MEMBERS_PERMISSION_DENIED'
      });
    }

    // Cannot change owner role
    if (team.ownerId === parseInt(memberUserId)) {
      return res.status(400).json({
        error: 'Cannot change team owner role',
        code: 'CANNOT_CHANGE_OWNER_ROLE'
      });
    }

    // Update role
    const success = await storage.updateTeamMemberRole(teamId, parseInt(memberUserId), role);
    if (!success) {
      return res.status(404).json({
        error: 'Team member not found',
        code: 'MEMBER_NOT_FOUND'
      });
    }

    // Get target user for logging
    const targetUser = await storage.getUser(parseInt(memberUserId));

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId,
      action: 'update',
      targetType: 'member',
      targetId: `${teamId}-${memberUserId}`,
      details: {
        event: 'member_role_updated',
        targetUsername: targetUser?.username,
        newRole: role
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Member role updated successfully'
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      error: 'Failed to update member role',
      code: 'UPDATE_MEMBER_ERROR'
    });
  }
});

// Remove team member
router.delete('/:teamId/members/:memberUserId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId, memberUserId } = req.params;
    const userId = req.userId!;

    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check permissions
    const userRole = await storage.getUserTeamRole(teamId, userId);
    const canManage = team.ownerId === userId || userRole === 'admin';
    const isSelfRemoval = userId === parseInt(memberUserId);

    if (!canManage && !isSelfRemoval) {
      return res.status(403).json({
        error: 'Insufficient permissions to remove member',
        code: 'REMOVE_MEMBER_PERMISSION_DENIED'
      });
    }

    // Cannot remove team owner
    if (team.ownerId === parseInt(memberUserId)) {
      return res.status(400).json({
        error: 'Cannot remove team owner',
        code: 'CANNOT_REMOVE_OWNER'
      });
    }

    // Get target user for logging
    const targetUser = await storage.getUser(parseInt(memberUserId));

    // Remove member
    const success = await storage.removeTeamMember(teamId, parseInt(memberUserId));
    if (!success) {
      return res.status(404).json({
        error: 'Team member not found',
        code: 'MEMBER_NOT_FOUND'
      });
    }

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId,
      action: 'delete',
      targetType: 'member',
      targetId: `${teamId}-${memberUserId}`,
      details: {
        event: isSelfRemoval ? 'member_left' : 'member_removed',
        targetUsername: targetUser?.username
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({
      error: 'Failed to remove team member',
      code: 'REMOVE_MEMBER_ERROR'
    });
  }
});

// Join team by invite code
router.post('/join/:inviteCode', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.userId!;

    const team = await storage.getTeamByInviteCode(inviteCode);
    if (!team) {
      return res.status(404).json({
        error: 'Invalid invite code',
        code: 'INVALID_INVITE_CODE'
      });
    }

    // Check if user is already a member
    const existingRole = await storage.getUserTeamRole(team.id, userId);
    if (existingRole) {
      return res.status(409).json({
        error: 'You are already a member of this team',
        code: 'ALREADY_MEMBER',
        currentRole: existingRole
      });
    }

    // Check team member limit
    const currentMembers = await storage.getTeamMembers(team.id);
    if (currentMembers.length >= team.maxMembers) {
      return res.status(400).json({
        error: 'Team has reached maximum member limit',
        code: 'MEMBER_LIMIT_REACHED',
        maxMembers: team.maxMembers
      });
    }

    // Add user as team member
    const member = await storage.addTeamMember(team.id, userId, 'member');

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId: team.id,
      action: 'join',
      targetType: 'team',
      targetId: team.id,
      details: {
        event: 'member_joined_via_invite',
        inviteCode
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Successfully joined team',
      team: {
        id: team.id,
        name: team.name,
        description: team.description
      },
      member
    });
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({
      error: 'Failed to join team',
      code: 'JOIN_TEAM_ERROR'
    });
  }
});

// Regenerate team invite code
router.post('/:teamId/regenerate-invite', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId!;

    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check permissions (owner or admin)
    const userRole = await storage.getUserTeamRole(teamId, userId);
    const canManage = team.ownerId === userId || userRole === 'admin';

    if (!canManage) {
      return res.status(403).json({
        error: 'Insufficient permissions to regenerate invite code',
        code: 'REGENERATE_INVITE_PERMISSION_DENIED'
      });
    }

    // Generate new invite code
    const newInviteCode = generateRandomString(12);
    const updatedTeam = await storage.updateTeam(teamId, {
      inviteCode: newInviteCode
    });

    // Log activity
    await storage.createActivityLog({
      userId,
      teamId,
      action: 'update',
      targetType: 'team',
      targetId: teamId,
      details: {
        event: 'invite_code_regenerated'
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Invite code regenerated successfully',
      inviteCode: newInviteCode,
      inviteUrl: `${req.protocol}://${req.get('host')}/teams/join/${newInviteCode}`
    });
  } catch (error) {
    console.error('Regenerate invite code error:', error);
    res.status(500).json({
      error: 'Failed to regenerate invite code',
      code: 'REGENERATE_INVITE_ERROR'
    });
  }
});

// Get team activity
router.get('/:teamId/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user has access to team
    const team = await storage.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    const userRole = await storage.getUserTeamRole(teamId, userId);
    const hasAccess = userRole !== null || team.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const activities = await storage.getTeamActivity(teamId, limit);

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
    console.error('Get team activity error:', error);
    res.status(500).json({
      error: 'Failed to fetch team activity',
      code: 'FETCH_TEAM_ACTIVITY_ERROR'
    });
  }
});

export default router;