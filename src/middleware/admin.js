const jwt = require('jsonwebtoken');
const pool = require('../db');

function isSuperAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

function isAdminCapableRole(role) {
  return isSuperAdminRole(role) || role === 'league_admin';
}

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Verifies the Bearer token on the request and loads the user from the database.
// Throws AuthError on any failure.
async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError(401, 'Please log in to continue');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not set');
    throw new AuthError(500, 'Server misconfigured');
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.substring(7), secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AuthError(401, 'Token expired');
    throw new AuthError(401, 'Invalid token');
  }

  const [rows] = await pool.query(
    'SELECT id, name, email, role FROM players WHERE id = ? LIMIT 1',
    [decoded.sub]
  );
  const user = rows && rows[0];
  if (!user) {
    throw new AuthError(401, 'User not found');
  }
  return user;
}

// Throws AuthError unless the user may administer the league in req.league.
async function assertLeagueAdmin(req, user) {
  if (!isAdminCapableRole(user.role)) {
    throw new AuthError(403, 'Admin access required');
  }

  // League admins are restricted to their current league context.
  if (user.role === 'league_admin') {
    if (!req.league?.id) {
      throw new AuthError(403, 'League admin access requires league context');
    }

    const [leagueMembership] = await pool.query(
      'SELECT 1 FROM league_players WHERE league_id = ? AND player_id = ? LIMIT 1',
      [req.league.id, user.id]
    );

    if (!leagueMembership.length) {
      throw new AuthError(403, 'League admin is not a member of this league');
    }
  }
}

function handleAuthError(err, res, label) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`${label} error:`, err);
  return res.status(500).json({ error: 'Authentication failed' });
}

function makeMiddleware(label, check) {
  return async function (req, res, next) {
    try {
      const user = await authenticate(req);
      if (check) await check(req, user);
      req.user = user;
      return next();
    } catch (err) {
      return handleAuthError(err, res, label);
    }
  };
}

// Any logged-in user.
const requireAuth = makeMiddleware('Auth');

// Super admin, or a league admin who belongs to the league in the URL.
const requireAdmin = makeMiddleware('Admin auth', assertLeagueAdmin);

// Any admin-capable role, without a league check. For global resources
// (such as courses) that are not tied to one league.
const requireAnyAdmin = makeMiddleware('Admin auth', async (req, user) => {
  if (!isAdminCapableRole(user.role)) {
    throw new AuthError(403, 'Admin access required');
  }
});

const requireSuperAdmin = makeMiddleware('Super admin auth', async (req, user) => {
  if (!isSuperAdminRole(user.role)) {
    throw new AuthError(403, 'Super admin access required');
  }
});

module.exports = {
  requireAuth,
  requireAdmin,
  requireAnyAdmin,
  requireSuperAdmin,
  authenticate,
  assertLeagueAdmin,
  AuthError,
  isAdminCapableRole,
  isSuperAdminRole
};
