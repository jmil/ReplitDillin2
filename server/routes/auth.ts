import { Router } from 'express';
import { 
  hashPassword, 
  verifyPassword, 
  generateAuthResponse,
  authenticateToken,
  authenticateOptionalToken,
  setAuthCookies,
  clearAuthCookies,
  validatePassword,
  validateEmail,
  verifyToken,
  sanitizeUser,
  AuthRequest
} from '../auth';
import { storage } from '../storage';
import { insertUserSchema } from '@shared/schema';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, fullName } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate email format if provided
    if (email && !validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        code: 'WEAK_PASSWORD',
        details: passwordValidation.errors
      });
    }

    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        error: 'Username already exists',
        code: 'USERNAME_EXISTS'
      });
    }

    // Check if email already exists
    if (email) {
      const existingEmailUser = await storage.getUserByEmail(email);
      if (existingEmailUser) {
        return res.status(409).json({
          error: 'Email already registered',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const newUser = await storage.createUser({
      username,
      password: hashedPassword,
      email,
      fullName
    });

    // Generate auth response
    const authResponse = generateAuthResponse(newUser);
    
    // Set HTTP-only cookies
    setAuthCookies(res, authResponse);

    // Log registration activity
    await storage.createActivityLog({
      userId: newUser.id,
      action: 'create',
      targetType: 'user',
      targetId: newUser.id.toString(),
      details: { event: 'user_registered' },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      ...authResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password, remember = false } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by username or email
    let user = await storage.getUserByUsername(username);
    if (!user && validateEmail(username)) {
      user = await storage.getUserByEmail(username);
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate auth response
    const authResponse = generateAuthResponse(user);
    
    // Set HTTP-only cookies (longer expiry if "remember me")
    setAuthCookies(res, authResponse);

    // Log login activity
    await storage.createActivityLog({
      userId: user.id,
      action: 'login',
      targetType: 'user',
      targetId: user.id.toString(),
      details: { 
        event: 'user_login',
        remember 
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Login successful',
      ...authResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return res.status(403).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Get current user
    const user = await storage.getUser(payload.userId);
    if (!user || !user.isActive) {
      return res.status(403).json({
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new auth response
    const authResponse = generateAuthResponse(user);
    
    // Set new cookies
    setAuthCookies(res, authResponse);

    res.json({
      message: 'Token refreshed successfully',
      ...authResponse
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

// Logout user
router.post('/logout', authenticateOptionalToken, async (req: AuthRequest, res) => {
  try {
    // Clear cookies
    clearAuthCookies(res);

    // Log logout activity if user is authenticated
    if (req.userId) {
      await storage.createActivityLog({
        userId: req.userId,
        action: 'logout',
        targetType: 'user',
        targetId: req.userId.toString(),
        details: { event: 'user_logout' },
        metadata: {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });
    }

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      code: 'PROFILE_ERROR'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { email, fullName, avatar } = req.body;
    const userId = req.userId!;

    // Validate email if provided
    if (email && !validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({
          error: 'Email already in use',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    // Update user
    const updatedUser = await storage.updateUser(userId, {
      email,
      fullName,
      avatar
    });

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Log profile update activity
    await storage.createActivityLog({
      userId,
      action: 'update',
      targetType: 'user',
      targetId: userId.toString(),
      details: { 
        event: 'profile_updated',
        fields: Object.keys(req.body)
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'UPDATE_ERROR'
    });
  }
});

// Change password
router.put('/password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId!;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'New password does not meet requirements',
        code: 'WEAK_PASSWORD',
        details: passwordValidation.errors
      });
    }

    // Get current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Hash new password and update
    const hashedNewPassword = await hashPassword(newPassword);
    await storage.updateUser(userId, {
      password: hashedNewPassword
    });

    // Log password change activity
    await storage.createActivityLog({
      userId,
      action: 'update',
      targetType: 'user',
      targetId: userId.toString(),
      details: { event: 'password_changed' },
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// Check authentication status
router.get('/status', authenticateOptionalToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.json({
        authenticated: false,
        user: null
      });
    }

    const user = await storage.getUser(req.userId);
    if (!user || !user.isActive) {
      return res.json({
        authenticated: false,
        user: null
      });
    }

    res.json({
      authenticated: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.json({
      authenticated: false,
      user: null
    });
  }
});

// Get user activity log
router.get('/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;

    const activities = await storage.getUserActivity(userId, limit);

    res.json({
      activities: activities.map(activity => ({
        ...activity,
        metadata: undefined // Don't expose sensitive metadata
      }))
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch activity',
      code: 'ACTIVITY_ERROR'
    });
  }
});

export default router;