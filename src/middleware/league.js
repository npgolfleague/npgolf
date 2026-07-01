const pool = require('../db');

// Middleware to extract and validate league alias from URL
// Supports URLs like: /paradise/api/tournaments or /paradise/tournaments
const leagueAliasMiddleware = async (req, res, next) => {
  // Extract potential alias from the URL path
  // Format: /{alias}/api/... or /{alias}/...
  const pathParts = req.path.split('/').filter(part => part.length > 0);
  
  // Check if first part could be a league alias (not 'api' or common routes)
  if (pathParts.length > 0 && pathParts[0] !== 'api' && !isCommonRoute(pathParts[0])) {
    const alias = pathParts[0];
    
    try {
      // Lookup league by alias. Older databases may not have cup_name yet.
      let rows
      try {
        [rows] = await pool.query(
          'SELECT id, billing_entity_id, name, alias, cup_name, active FROM leagues WHERE alias = ? LIMIT 1',
          [alias]
        )
      } catch (queryErr) {
        if (queryErr?.code !== 'ER_BAD_FIELD_ERROR') {
          throw queryErr
        }

        const [legacyRows] = await pool.query(
          'SELECT id, billing_entity_id, name, alias, active FROM leagues WHERE alias = ? LIMIT 1',
          [alias]
        )

        rows = legacyRows.map((row) => ({
          ...row,
          cup_name: 'Paradise Cup'
        }))
      }
      
      if (rows.length === 0) {
        console.log(`⚠️  League alias '${alias}' not found in database`);
        // League not found - only return error if this is an API request
        // For frontend routes, pass through to let Express handle it normally
        if (pathParts.includes('api')) {
          return res.status(404).json({ error: `League '${alias}' not found` });
        }
        // Not an API route, pass through
        return next();
      }
      
      const league = rows[0];
      
      if (!league.active) {
        return res.status(403).json({ error: `League '${alias}' is not active` });
      }
      
      // Attach league info to request object
      req.league = league;
      console.log(`✓ League context set: ${league.name} (${league.alias})`);
      
      // Rewrite the URL to remove the alias prefix for downstream routes
      // /paradise/api/tournaments -> /api/tournaments
      // /paradise/tournaments -> /tournaments
      req.url = '/' + pathParts.slice(1).join('/');
      req.originalLeagueUrl = req.path;
      
    } catch (err) {
      console.error('League alias middleware error:', err);
      return res.status(500).json({ error: 'Failed to resolve league' });
    }
  }
  
  next();
};

// Routes that should not be treated as league aliases
const commonRoutes = [
  'api', 'login', 'register', 'forgot-password', 'reset-password',
  'sms-consent', 'dashboard', 'about', 'robots.txt', 'favicon.svg',
  'favicon.ico', 'assets', 'npgolf-logo.svg', 'league-select', 'billing-entities',
  'sitemap.xml', 'wp-login.php', 'wp-admin'
];

function isCommonRoute(segment) {
  return commonRoutes.includes(segment);
}

// Middleware to ensure league context exists (for routes that require it)
const requireLeague = (req, res, next) => {
  if (!req.league) {
    return res.status(400).json({ 
      error: 'League context required. Please access via /{league-alias}/...' 
    });
  }
  next();
};

module.exports = { leagueAliasMiddleware, requireLeague };
