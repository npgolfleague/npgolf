// Escape a value for use in HTML text or a quoted attribute. Player names,
// course names and similar come from user input (anyone can register), so every
// page, email or PDF built as a string must escape them.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);

// Public confirmation pages need inline styles and nothing else.
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const htmlPageHeaders = (_req, res, next) => {
  res.set('Content-Security-Policy', PAGE_CSP);
  res.set('X-Content-Type-Options', 'nosniff');
  next();
};

module.exports = { escapeHtml, htmlPageHeaders };
