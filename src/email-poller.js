// IMAP email poller for commish@npgolf.net (Zoho Mail)
// Polls the inbox periodically and stores new emails in the database

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const pool = require('./db');

const POLL_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes

function createImapConnection() {
  return new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.zoho.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    },
    tls: {
      rejectUnauthorized: true
    },
    logger: false
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

async function pollInbox() {
  const imap = createImapConnection();
  let processed = 0;

  try {
    await imap.connect();
    const lock = await imap.getMailboxLock('INBOX');

    try {
      const unseenUids = await imap.search({ seen: false });
      if (!unseenUids || unseenUids.length === 0) return;

      console.log(`[EmailPoller] Found ${unseenUids.length} unseen email(s)`);

      for await (const message of imap.fetch(unseenUids, { uid: true, source: true })) {
        try {
          const parsed = await processMessage(message.source);
          const stored = await storeEmail(parsed);
          if (stored) {
            processed++;
            console.log(`[EmailPoller] Stored email from ${parsed.from?.text}: ${parsed.subject}`);
          }
          await imap.messageFlagsAdd(message.uid, ['\\Seen']);
        } catch (e) {
          console.error('[EmailPoller] Error processing message:', e.message);
        }
      }
    } finally {
      lock.release();
    }

    if (processed > 0) {
      console.log(`[EmailPoller] Stored ${processed} new email(s)`);
    }
  } catch (err) {
    console.error('[EmailPoller] IMAP connection error:', err.message);
  } finally {
    try {
      await imap.logout();
    } catch (_) {
      // noop: safe cleanup path when connection was never established
    }
  }
}

function startEmailPoller() {
  const pollerEnabled = String(process.env.EMAIL_POLLER_ENABLED || 'true').toLowerCase() === 'true';
  if (!pollerEnabled) {
    console.log('[EmailPoller] Disabled by EMAIL_POLLER_ENABLED=false');
    return;
  }

  if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
    console.log('[EmailPoller] IMAP settings not configured (IMAP_USER/IMAP_PASSWORD), skipping email poller');
    return;
  }

  console.log(`[EmailPoller] Starting — polling every ${POLL_INTERVAL_MS / 1000}s for ${process.env.IMAP_USER}`);

  // Run immediately on startup, then on interval
  pollInbox();
  setInterval(() => {
    pollInbox();
  }, POLL_INTERVAL_MS);
}

module.exports = { startEmailPoller };
