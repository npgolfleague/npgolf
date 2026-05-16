const jwt = require('jsonwebtoken');
const pool = require('../db');

function isSuperAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

function isAdminCapableRole(role) {
  return isSuperAdminRole(role) || role === 'league_admin';
}

// Middleware to verify JWT and ensure user is an admin
async function requireAdmin(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Verify token
    const decoded = jwt.verify(token, secret);
    const userId = decoded.sub;

    // Get user from database and check role
    const [rows] = await pool.query(
      'SELECT id, name, email, role FROM players WHERE id = ? LIMIT 1',
      [userId]
    );

    const user = rows && rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!isAdminCapableRole(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // League admins are restricted to their current league context.
    if (user.role === 'league_admin') {
      if (!req.league?.id) {
        return res.status(403).json({ error: 'League admin access requires league context' });
      }

      const [leagueMembership] = await pool.query(
        'SELECT 1 FROM league_players WHERE league_id = ? AND player_id = ? LIMIT 1',
        [req.league.id, user.id]
      );

      if (!leagueMembership.length) {
        return res.status(403).json({ error: 'League admin is not a member of this league' });
      }
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Admin auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

async function requireSuperAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const decoded = jwt.verify(token, secret);
    const userId = decoded.sub;

    const [rows] = await pool.query(
      'SELECT id, name, email, role FROM players WHERE id = ? LIMIT 1',
      [userId]
    );

    const user = rows && rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!isSuperAdminRole(user.role)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Super admin auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = { requireAdmin, requireSuperAdmin, isAdminCapableRole, isSuperAdminRole };
