// Who may see contact details: admins of the league, and players their own.
const { authenticate, assertLeagueAdmin, AuthError } = require('../middleware/admin');

// For routes open to everyone: is this request from a league admin?
const isAdminRequest = async (req) => {
  if (!req.headers.authorization) return false;
  try {
    const user = req.user || await authenticate(req);
    await assertLeagueAdmin(req, user);
    return true;
  } catch (err) {
    if (err instanceof AuthError) return false;
    throw err;
  }
};

const without = (row, fields) => {
  const copy = { ...row };
  fields.forEach((f) => delete copy[f]);
  return copy;
};

// Player rows (with id): drop email and phone except the viewer's own.
const hideContacts = async (req, rows) => {
  if (await isAdminRequest(req)) return rows;
  return rows.map((r) => (Number(r.id) === Number(req.user?.id) ? r : without(r, ['email', 'phone', 'sms_allowed', 'email_allowed'])));
};

const LEAGUE_CONTACTS = ['billing_email'];
const SETTINGS_CONTACTS = ['golf_course_email', 'outgoing_email_from'];

const hideFields = async (req, value, fields) => {
  if (await isAdminRequest(req)) return value;
  return Array.isArray(value) ? value.map((r) => without(r, fields)) : without(value, fields);
};

module.exports = { hideContacts, hideFields, LEAGUE_CONTACTS, SETTINGS_CONTACTS };
