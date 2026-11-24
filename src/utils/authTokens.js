// Access tokens carry a fingerprint of the account's current password, so
// changing the password ends every session that was open before it.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const passwordFingerprint = (passwordHash, secret = process.env.JWT_SECRET) => (
  crypto.createHmac('sha256', secret).update(String(passwordHash || '')).digest('hex').slice(0, 32)
);

const signAccessToken = ({ id, email, password }, secret, expiresIn) => (
  jwt.sign({ sub: id, email, pv: passwordFingerprint(password, secret) }, secret, { expiresIn })
);

module.exports = { passwordFingerprint, signAccessToken };
