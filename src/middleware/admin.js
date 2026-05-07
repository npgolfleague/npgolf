const jwt = require('jsonwebtoken');
const pool = require('../db');

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

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
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

module.exports = { requireAdmin };
