const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const prisma = require('../config/database');
const config = require('../config/config');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).optional(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  condition: Joi.string().optional(),
  severity: Joi.string().valid('mild', 'moderate', 'severe').optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details
      });
    }

    const { email, username, password, firstName, lastName, condition, severity } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        field: existingUser.email === email ? 'email' : 'username'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        condition,
        severity,
        settings: {
          predictionSensitivity: 0.7,
          audioFeedback: true,
          visualCues: true,
          fontSize: 'large',
          highContrast: false,
          autoSave: true,
          voice: 'sarah'
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        condition: true,
        severity: true,
        settings: true,
        createdAt: true
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email 
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpireTime }
    );

    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: 'user_registration',
      resource: 'user',
      newValue: { email, username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details
      });
    }

    const { email, password } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        firstName: true,
        lastName: true,
        condition: true,
        severity: true,
        settings: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email 
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpireTime }
    );

    // Remove password from response
    const { password: _, ...userResponse } = user;

    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: 'user_login',
      resource: 'user',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required'
      });
    }

    // Verify current token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    // Generate new token
    const newToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email 
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpireTime }
    );

    res.json({
      success: true,
      token: newToken,
      user
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout (client-side token removal)
 */
router.post('/logout', async (req, res) => {
  try {
    // In a more advanced implementation, you might want to blacklist the token
    // For now, we'll just log the event
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        
        await logAuditEvent({
          userId: decoded.id,
          action: 'user_logout',
          resource: 'user',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (error) {
        // Token might be expired, but that's ok for logout
      }
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Password reset request
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true }
    });

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

    // Only proceed if user exists
    if (user) {
      // In a real implementation, you would:
      // 1. Generate a secure reset token
      // 2. Store it in database with expiration
      // 3. Send email with reset link
      
      console.log(`Password reset requested for user ${user.id} (${user.email})`);
      
      await logAuditEvent({
        userId: user.id,
        action: 'password_reset_request',
        resource: 'user',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/verify-token
 * Verify JWT token validity
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        condition: true,
        severity: true,
        settings: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      valid: true,
      user,
      expiresAt: new Date(decoded.exp * 1000)
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Token expired'
      });
    }

    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Token verification failed',
      message: error.message
    });
  }
});

/**
 * Helper function to log audit events
 */
async function logAuditEvent(data) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        oldValue: data.oldValue,
        newValue: data.newValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

module.exports = router;