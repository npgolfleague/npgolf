// Links in invitations and opt-in messages work without logging in, so each one
// carries a signature for exactly that player, round and answer. Without it,
// anyone could act for any player by changing the ids in the address.
const crypto = require('crypto');

const signature = (...parts) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  // Separate key from login tokens, derived from the same secret.
  const key = crypto.createHmac('sha256', secret).update('npgolf-signed-links').digest();
  return crypto.createHmac('sha256', key).update(JSON.stringify(parts.map(String))).digest('base64url').slice(0, 22);
};

const matches = (given, ...parts) => {
  const expected = Buffer.from(signature(...parts));
  const actual = Buffer.from(typeof given === 'string' ? given : '');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const baseUrl = () => process.env.APP_BASE_URL || 'http://localhost:3000';

const confirmLink = (tournamentId, playerId, response) => (
  `${baseUrl()}/api/tournaments/${tournamentId}/confirm?playerId=${playerId}&response=${response}&sig=${signature('confirm', tournamentId, playerId, response)}`
);
const rsvpLink = (tournamentId, playerId) => (
  `${baseUrl()}/api/tournaments/${tournamentId}/rsvp?playerId=${playerId}&sig=${signature('rsvp', tournamentId, playerId)}`
);
const optInLink = (kind, playerId) => (
  `${baseUrl()}/api/players/${playerId}/${kind}-opt-in?sig=${signature(`${kind}-opt-in`, playerId)}`
);

const page = (title, text) => `<!doctype html><html><head><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;"><h1>${title}</h1><p>${text}</p></body></html>`;

// Express middleware: getParts(req) lists what the link was signed for.
const requireSignedLink = (getParts) => (req, res, next) => {
  if (matches(req.query.sig, ...getParts(req))) return next();
  return res.status(403).send(page('This link isn\'t valid',
    'It may be from an older message. Ask your league admin for a new one.'));
};

module.exports = { confirmLink, rsvpLink, optInLink, requireSignedLink, page };
