// IMAP email poller for commish@npgolf.net (Zoho Mail)
// Polls the inbox periodically and stores new emails in the database

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pool = require('./db');

const POLL_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes

function createImapConnection() {
  return new Imap({
    user: process.env.IMAP_USER || process.env.SMTP_USER,
    password: process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD,
    host: process.env.IMAP_HOST || 'imap.zoho.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: true },
    connTimeout: 15000,
    authTimeout: 10000,
  });
}

async function processMessage(stream) {
  return new Promise((resolve, reject) => {
    simpleParser(stream, (err, parsed) => {
      if (err) return reject(err);
      resolve(parsed);
    });
  });
}

async function storeEmail(parsed) {
  const fromAddress = parsed.from?.value?.[0];
  const fromEmail = fromAddress?.address || '';
  const fromName = fromAddress?.name || null;
  const toEmail = parsed.to?.value?.map(v => v.address).join(', ') || '';
  const subject = parsed.subject || '(No subject)';
  const text = parsed.text || '';
  const html = parsed.html || '';

  // Check for duplicate by Message-ID
  const messageId = parsed.messageId || null;
  if (messageId) {
    const [existing] = await pool.query(
      'SELECT id FROM emails WHERE message_id = ? LIMIT 1',
      [messageId]
    );
    if (existing.length > 0) {
      return false; // already stored
    }
  }

  await pool.query(
    `INSERT INTO emails (from_email, from_name, to_email, subject, text, html, message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fromEmail, fromName, toEmail, subject, text, html, messageId]
  );
  return true;
}

function pollInbox() {
  const imap = createImapConnection();
  let processed = 0;

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('[EmailPoller] Failed to open inbox:', err.message);
        imap.end();
        return;
      }

      // Search for unseen emails
      imap.search(['UNSEEN'], (err, uids) => {
        if (err) {
          console.error('[EmailPoller] Search error:', err.message);
          imap.end();
          return;
        }

        if (!uids || uids.length === 0) {
          imap.end();
          return;
        }

        console.log(`[EmailPoller] Found ${uids.length} unseen email(s)`);

        const fetch = imap.fetch(uids, { bodies: '', markSeen: true });
        const promises = [];

        fetch.on('message', (msg) => {
          const promise = new Promise((resolve) => {
            msg.on('body', async (stream) => {
              try {
                const parsed = await processMessage(stream);
                const stored = await storeEmail(parsed);
                if (stored) {
                  processed++;
                  console.log(`[EmailPoller] Stored email from ${parsed.from?.text}: ${parsed.subject}`);
                }
              } catch (e) {
                console.error('[EmailPoller] Error processing message:', e.message);
              }
              resolve();
            });
          });
          promises.push(promise);
        });

        fetch.once('error', (err) => {
          console.error('[EmailPoller] Fetch error:', err.message);
        });

        fetch.once('end', async () => {
          await Promise.all(promises);
          if (processed > 0) {
            console.log(`[EmailPoller] Stored ${processed} new email(s)`);
          }
          imap.end();
        });
      });
    });
  });

  imap.once('error', (err) => {
    console.error('[EmailPoller] IMAP connection error:', err.message);
  });

  imap.connect();
}

function startEmailPoller() {
  const pollerEnabled = String(process.env.EMAIL_POLLER_ENABLED || 'true').toLowerCase() === 'true';
  if (!pollerEnabled) {
    console.log('[EmailPoller] Disabled by EMAIL_POLLER_ENABLED=false');
    return;
  }

  if (!process.env.SMTP_USER && !process.env.IMAP_USER) {
    console.log('[EmailPoller] No IMAP credentials configured, skipping email poller');
    return;
  }

  console.log(`[EmailPoller] Starting — polling every ${POLL_INTERVAL_MS / 1000}s for ${process.env.IMAP_USER || process.env.SMTP_USER}`);

  // Run immediately on startup, then on interval
  pollInbox();
  setInterval(pollInbox, POLL_INTERVAL_MS);
}

module.exports = { startEmailPoller };
