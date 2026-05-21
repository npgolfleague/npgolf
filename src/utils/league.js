// Helper to get league ID from request context or default to 1
function getLeagueId(req) {
  return req.league ? req.league.id : 1;
}

module.exports = { getLeagueId };
