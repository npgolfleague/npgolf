// Twilio signs its webhooks with the account's auth token. Without the token
// configured the webhook is off (Twilio itself still honours STOP).
const twilio = require('twilio');

const requireTwilioSignature = (req, res, next) => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return res.status(404).send('Not found');
  const base = (process.env.APP_BASE_URL || `https://${req.get('host')}`).replace(/\/$/, '');
  const ok = twilio.validateRequest(authToken, req.get('x-twilio-signature') || '', `${base}${req.originalUrl}`, req.body || {});
  return ok ? next() : res.status(403).send('Forbidden');
};

module.exports = { requireTwilioSignature };
