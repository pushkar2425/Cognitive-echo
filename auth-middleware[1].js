const jwt = require('jsonwebtoken');
const config = require('../config/config');
const prisma = require('../config/database');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided or invalid format'
      });
    }

    // Extract token
    const token = authHeader.substring(7);

    // Verify token
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
        createdAt: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not found or account deactivated'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    req.tokenData = decoded;

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Sets user if token is valid, but doesn't require it
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        settings: true
      }
    });

    if (user) {
      req.user = user;
      req.userId = user.id;
      req.tokenData = decoded;
    }

    next();

  } catch (error) {
    // Token invalid, but continue without user
    next();
  }
};

/**
 * Role-based Authorization Middleware
 * Requires specific roles or permissions
 */
const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Authentication required'
      });
    }

    // For now, we don't have roles in our schema
    // This is a placeholder for future role-based access control
    const userRoles = req.user.roles || ['user'];
    
    const hasPermission = roles.some(role => userRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Rate Limiting Middleware (per user)
 * Limits requests per user per time window
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map(); // In production, use Redis
  
  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    let userRequests = requests.get(userId) || [];
    
    // Remove old requests outside the window
    userRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${maxRequests} per ${windowMs / 60000} minutes`,
        retryAfter: Math.ceil((userRequests[0] - windowStart) / 1000)
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);

    next();
  };
};

/**
 * API Key Authentication Middleware
 * For service-to-service communication
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'X-API-Key header is required'
    });
  }

  // In production, validate against database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  // Mark as API request
  req.isApiRequest = true;
  next();
};

/**
 * Session Validation Middleware
 * Ensures session belongs to authenticated user
 */
const validateSession = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Check if session belongs to user
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user.id
      }
    });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session does not exist or does not belong to you'
      });
    }

    req.session = session;
    next();

  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      error: 'Session validation failed',
      message: error.message
    });
  }
};

/**
 * Request Logging Middleware
 * Logs API requests for authenticated users
 */
const logRequest = (req, res, next) => {
  if (req.user) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user.id}`);
  }
  next();
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  userRateLimit,
  apiKeyAuth,
  validateSession,
  logRequest
};