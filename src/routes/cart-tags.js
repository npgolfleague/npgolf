const express = require('express');
const router = express.Router();
const pool = require('../db');
const QRCode = require('qrcode');
const { sendEmail } = require('../email');
const { generatePDF } = require('../pdf');
const { getLeagueId } = require('../utils/league');

const GROUP_EMAIL_COPY_TO = 'commish@npgolf.net';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getOutgoingEmailDelayMs = () => Math.max(Number(process.env.OUTGOING_EMAIL_DELAY_MS || process.env.INVITATION_EMAIL_DELAY_MS || 3000), 0);

const parseSemicolonEmails = (value) => {
  if (value == null) return [];
  return String(value)
    .split(';')
    .map(v => v.trim())
    .filter(Boolean);
};

// Helper to format time from MySQL TIME format or add minutes
const formatTeeTime = (baseTime, addMinutes = 0) => {
  if (!baseTime) return '';
  
  // Parse HH:MM:SS or HH:MM format
  const parts = String(baseTime).split(':');
  let hours = parseInt(parts[0]);
  let minutes = parseInt(parts[1]);
  
  // Add the offset minutes
  minutes += addMinutes;
  hours += Math.floor(minutes / 60);
  minutes = minutes % 60;
  hours = hours % 24;
  
  // Format as 12-hour time
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');
  
  return `${displayHours}:${displayMinutes} ${period}`;
};

const getStartingHoleLabel = (groupName) => {
  const normalized = String(groupName || '').trim();
  const match = normalized.match(/^(\d{1,2})(?:\s*([a-zA-Z]))?/);
  if (!match) return '1';

  const holeNumber = parseInt(match[1], 10);
  if (Number.isNaN(holeNumber) || holeNumber < 1 || holeNumber > 18) return '1';

  const suffix = match[2] ? ` ${match[2]}` : '';
  return `${holeNumber}${suffix}`;
};

const getGroupTeeTime = (baseTime, groupIndex, shotgunStart) => {
  if (!baseTime) return '';
  return formatTeeTime(baseTime, shotgunStart ? 0 : groupIndex * 8);
};

// Generate HTML for a single cart tag (styled to fit two-per-page)
const generateCartTagHTML = (leagueName, courseName, playerNames, teeTime, startingHole = 1, qrDataURL = '') => {
  return `
    <div class="cart-tag">
      <div style="text-align: center;">
        <div class="cg-title">${leagueName}</div>
        <div class="cg-course">${courseName}</div>
      </div>
      <div class="cg-players">
        ${playerNames.map(player => {
          const displayName = typeof player === 'string' ? player : (player.tee_name ? `${player.name} <span style="font-size: 0.65em;">(${player.tee_name})</span>` : player.name);
          return `
          <div class="cg-player">${displayName}</div>
        `;
        }).join('')}
      </div>
      <div class="cg-footer" style="align-items: center;">
        <div style="flex:1"><span style="font-weight: normal;">Time:</span> ${teeTime}</div>
        <div style="flex:1; text-align:center"><span style="font-weight: normal;">Hole:</span> ${startingHole}</div>
        <div style="width: 88px; text-align: right;">
          ${qrDataURL ? `<img src="${qrDataURL}" alt="QR" style="width:72px;height:72px;border:0;"/>` : ''}
        </div>
      </div>
    </div>
  `;
};

// Generate email-friendly cart tag using tables (email clients don't support flexbox)
const generateCartTagEmailHTML = (leagueName, courseName, playerNames, teeTime, startingHole = 1, qrDataURL = '') => {
  return `
    <table style="
      width: 100%;
      max-width: 600px;
      margin: 20px auto;
      border: 3px solid #1e5631;
      border-collapse: collapse;
      font-family: Georgia, serif;
      background: white;
    ">
      <tr>
        <td style="padding: 20px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #1e5631; letter-spacing: 1px;">
            ${leagueName}
          </div>
          <div style="font-size: 14px; color: #333; font-style: italic; margin-top: 8px;">
            ${courseName}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding: 40px 20px; text-align: center;">
          ${playerNames.map(player => {
            const displayName = typeof player === 'string' ? player : (player.tee_name ? `${player.name} <span style="font-size: 0.65em;">(${player.tee_name})</span>` : player.name);
            return `
            <div style="font-size: 36px; font-weight: bold; color: #1e5631; margin: 15px 0; line-height: 1.2;">
              ${displayName}
            </div>
          `;
          }).join('')}
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table style="width: 100%;">
            <tr>
              <td style="font-size: 20px; font-weight: bold; color: #333; text-align: left;">
                <span style="font-weight: normal;">Time:</span> ${teeTime}
              </td>
              <td style="font-size: 20px; font-weight: bold; color: #333; text-align: right;">
                <span style="font-weight: normal;">Hole:</span> ${startingHole}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

// Generate full printable page with all cart tags
const generateCartTagsDocument = (leagueNameOrTags, maybeTags) => {
  const leagueName = Array.isArray(leagueNameOrTags) ? 'Cart Tags' : leagueNameOrTags;
  const tags = Array.isArray(leagueNameOrTags) ? leagueNameOrTags : (Array.isArray(maybeTags) ? maybeTags : []);

  // Group tags two-per-page and include shared print CSS
  const pages = [];
  for (let i = 0; i < tags.length; i += 2) {
    const first = tags[i];
    const second = tags[i + 1] || '';
    pages.push(`<div class="page">${first}${second}</div>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cart Tags - ${leagueName}</title>
  <style>
    @page {
      size: letter;
      margin: 0.25in;
    }
    body {
      margin: 0;
      padding: 0;
      background: white;
    }
    .no-print { padding: 20px; background: #f0f0f0; margin-bottom: 20px; text-align: center; }
    @media print { .no-print { display: none; } }

    /* Page container holds two tags stacked vertically */
    .page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.2in 0;
    }

    /* Cart tag compacted slightly to ensure two fit on a letter page */
    .cart-tag {
      width: 7.5in;
      height: 4.75in;
      border: 2px solid #1e5631;
      padding: 0.25in;
      box-sizing: border-box;
      font-family: 'Georgia', serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      margin-bottom: 0.15in;
      background: white;
    }

    .cg-title { font-size: 24px; font-weight: bold; color: #1e5631; letter-spacing: 1px; margin-bottom: 6px; }
    .cg-course { font-size: 14px; color: #333; margin-bottom: 18px; font-style: italic; }
    .cg-players { text-align: center; flex-grow: 1; display:flex; flex-direction:column; justify-content:center; }
    .cg-player { font-size: 36px; font-weight: bold; color: #1e5631; margin: 8px 0; line-height: 1.1; }
    .cg-footer { display:flex; justify-content:space-between; font-size:18px; font-weight:bold; color:#333; }

    @media print {
      .cart-tag { border-width: 2px; }
      .cg-player { font-size: 34px; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Print Cart Tags</button>
  </div>
  ${pages.join('\n')}
</body>
</html>`;
};

const buildScoreLink = (req, tournamentId, group) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const leaguePrefix = req.league?.alias ? `/${req.league.alias}` : '';
  return `${baseUrl}${leaguePrefix}/scores?tid=${encodeURIComponent(tournamentId)}&foursome=${encodeURIComponent(group)}`;
};

const getNormalizedTournamentGroups = async (tournamentId) => {
  const groups = {};

  // From scores table
  const [scoreRows] = await pool.query(
    `SELECT s.foursome_group, p.name as player_name
     FROM scores s
     JOIN players p ON s.player_id = p.id
     WHERE s.tournament_id = ? AND s.foursome_group IS NOT NULL
     GROUP BY s.foursome_group, p.id
     ORDER BY s.foursome_group, p.name`,
    [tournamentId]
  );

  scoreRows.forEach(row => {
    if (!groups[row.foursome_group]) groups[row.foursome_group] = new Set();
    groups[row.foursome_group].add(row.player_name);
  });

  // From tournament_players table (allows assigning groups without scores)
  // Use `foursome` and `pair` columns on tournament_players
  const [tpRows] = await pool.query(
    `SELECT tp.foursome, tp.pair, p.name as player_name, tp.player_id, ct.tee_name
     FROM tournament_players tp
     JOIN players p ON tp.player_id = p.id
     LEFT JOIN course_tee ct ON ct.id = tp.tee_id
     WHERE tp.tournament_id = ? AND tp.foursome IS NOT NULL
     GROUP BY tp.foursome, tp.pair, p.id
     ORDER BY tp.foursome, tp.pair, p.name`,
    [tournamentId]
  );

  tpRows.forEach(row => {
    // Initialize as array if doesn't exist, or convert Set to array if it exists as a Set
    if (!groups[row.foursome]) {
      groups[row.foursome] = [];
    } else if (groups[row.foursome] instanceof Set) {
      // Convert Set to array of objects
      groups[row.foursome] = Array.from(groups[row.foursome]).map(name => ({ name, playerId: null, pair: null, tee_name: null }));
    }
    // store objects with player name, optional pair number, and tee name
    groups[row.foursome].push({ name: row.player_name, playerId: row.player_id, pair: row.pair == null ? null : Number(row.pair), tee_name: row.tee_name });
  });

  const groupKeys = Object.keys(groups);
  const groupsByName = {};
  groupKeys.forEach(g => {
    // groups[g] might be a Set (from scores) or an array (from tpRows)
    let arr;
    if (Array.isArray(groups[g])) {
      arr = groups[g];
    } else {
      // Set of names from scores - convert to objects without pair info
      arr = Array.from(groups[g]).map(name => ({ name, playerId: null, pair: null, tee_name: null }));
    }

    // Deduplicate by player name; prefer entries with pair info over null-pair duplicates
    // (a player in both scores and tournament_players would otherwise appear twice)
    const seen = new Map();
    arr.forEach(p => {
      const existing = seen.get(p.name);
      if (!existing || (existing.pair == null && p.pair != null)) {
        seen.set(p.name, p);
      }
    });
    groupsByName[g] = Array.from(seen.values());
  });

  return {
    groupNames: Object.keys(groupsByName).sort(),
    groupsByName
  };
};

const buildCartAssignments = (players) => {
  const carts = [];

  // If players have pair numbers, group by pair; otherwise fall back to sequential pairing
  const hasPairs = players.some(p => p.pair != null);
  if (hasPairs) {
    // group by pair number (nulls get their own unique index by order)
    const byPair = {};
    let noPairIdx = 1000; // large offset for null pairs
    players.forEach(p => {
      const key = p.pair == null ? `nopair_${noPairIdx++}` : `pair_${p.pair}`;
      if (!byPair[key]) byPair[key] = [];
      byPair[key].push(p);
    });

    Object.values(byPair).forEach(pairArr => {
      for (let i = 0; i < pairArr.length; i += 2) {
        carts.push(pairArr.slice(i, i + 2));
      }
    });
  } else {
    for (let i = 0; i < players.length; i += 2) {
      carts.push(players.slice(i, i + 2));
    }
  }

  return carts;
};

// GET /api/cart-tags/tournament/:tournamentId - Generate printable cart tags HTML
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    
    // Get tournament details
    const [tournamentRows] = await pool.query(
      `SELECT t.*, c.name as course_name
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentRows[0];
    const courseName = tournament.course_name;
    const firstTeeTime = tournament.first_tee_time;
    const shotgunStart = Number(tournament.shotgun_start) === 1;
    const [leagueRows] = await pool.query('SELECT name FROM leagues WHERE id = ? LIMIT 1', [tournament.league_id]);
    const leagueName = req.league?.name || leagueRows[0]?.name || 'Paradise Golf';
    
    const { groupNames, groupsByName } = await getNormalizedTournamentGroups(tournamentId);

    // Ensure we have at least one group
    if (groupNames.length === 0) {
      return res.status(404).json({ error: 'No foursome groups found for this tournament' });
    }
    
    // Generate cart tags (2 players per cart typically)
    const tags = [];
    
    // Pre-generate QR codes for each group linking to the score entry path
    const qrMap = {};
    await Promise.all(groupNames.map(async (g) => {
      try {
        const link = buildScoreLink(req, tournamentId, g);
        qrMap[g] = await QRCode.toDataURL(link);
      } catch (err) {
        console.error('Error generating QR for group', g, err);
        qrMap[g] = '';
      }
    }));

    groupNames.forEach((groupName, groupIndex) => {
      const players = groupsByName[groupName];
      const teeTime = getGroupTeeTime(firstTeeTime, groupIndex, shotgunStart);
      const startingHole = getStartingHoleLabel(groupName);

      const carts = buildCartAssignments(players);
      carts.forEach(cartPlayers => {
        tags.push(generateCartTagHTML(leagueName, courseName, cartPlayers, teeTime, startingHole, qrMap[groupName]));
      });
    });
    
    const html = generateCartTagsDocument(leagueName, tags);
    res.type('html').send(html);
    
  } catch (err) {
    console.error('Error generating cart tags:', err);
    res.status(500).json({ error: 'Failed to generate cart tags' });
  }
});

// POST /api/cart-tags/tournament/:tournamentId/send - Send cart tags and foursome list to golf course
router.post('/tournament/:tournamentId/send', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    
    // Get settings for golf course email
    const [settingsRows] = await pool.query('SELECT golf_course_email FROM league_settings WHERE league_id = ? LIMIT 1', [getLeagueId(req)]);
    const configuredGolfCourseEmail = settingsRows[0]?.golf_course_email;
    const golfCourseEmails = parseSemicolonEmails(configuredGolfCourseEmail);

    if (golfCourseEmails.length === 0) {
      return res.status(400).json({ error: 'Golf course email not configured in settings' });
    }

    const invalidEmail = golfCourseEmails.find(email => !EMAIL_REGEX.test(email));
    if (invalidEmail) {
      return res.status(400).json({ error: `Invalid golf course email configured: ${invalidEmail}` });
    }
    
    // Get tournament and course details
    const [tournamentRows] = await pool.query(
      `SELECT t.*, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentRows[0];
    
    const courseName = tournament.course_name;
    const firstTeeTime = tournament.first_tee_time;
    const shotgunStart = Number(tournament.shotgun_start) === 1;
    const [leagueRows] = await pool.query('SELECT name FROM leagues WHERE id = ? LIMIT 1', [tournament.league_id]);
    const leagueName = req.league?.name || leagueRows[0]?.name || 'Paradise Golf';
    const tournamentDate = new Date(tournament.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const { groupNames, groupsByName } = await getNormalizedTournamentGroups(tournamentId);
    if (groupNames.length === 0) {
      return res.status(404).json({ error: 'No foursome groups found for this tournament' });
    }

    // Pre-generate QR codes for email/pdf tags
    const qrMap2 = {};
    await Promise.all(groupNames.map(async (g) => {
      try {
        const link = buildScoreLink(req, tournamentId, g);
        qrMap2[g] = await QRCode.toDataURL(link);
      } catch (err) {
        console.error('Error generating QR for group (email):', g, err);
        qrMap2[g] = '';
      }
    }));

    // Build foursome list HTML
    let foursomeListHTML = '';
    groupNames.forEach((groupName, groupIndex) => {
      const players = groupsByName[groupName].map(p => p.name);
      const teeTime = getGroupTeeTime(firstTeeTime, groupIndex, shotgunStart);
      
      foursomeListHTML += `
        <tr style="background: ${groupIndex % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">${teeTime}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${groupName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${players.join(', ')}</td>
        </tr>
      `;
    });
    
    // Generate cart tags for email (use email-friendly table layout)
    const emailTags = [];
    const pdfTags = []; // For PDF generation
    groupNames.forEach((groupName, groupIndex) => {
      const players = groupsByName[groupName];
      const teeTime = getGroupTeeTime(firstTeeTime, groupIndex, shotgunStart);
      const startingHole = getStartingHoleLabel(groupName);

      const carts = buildCartAssignments(players);
      carts.forEach(cartPlayers => {
        emailTags.push(generateCartTagEmailHTML(leagueName, courseName, cartPlayers, teeTime, startingHole, qrMap2[groupName]));
        pdfTags.push(generateCartTagHTML(leagueName, courseName, cartPlayers, teeTime, startingHole, qrMap2[groupName]));
      });
    });
    
    // Create email
    const subject = `${leagueName} - Tournament Tee Sheet for ${tournamentDate}`;
    const emailHTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="background: #1e5631; color: white; padding: 30px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">${leagueName}</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px;">Tournament Tee Sheet</p>
    </div>
    
    <div style="padding: 24px;">
      <h2 style="color: #1e5631; margin-top: 0;">Tournament Details</h2>
      <p style="font-size: 16px; line-height: 1.6;">
        <strong>Date:</strong> ${tournamentDate}<br>
        <strong>Course:</strong> ${courseName}<br>
        <strong>First Tee Time:</strong> ${formatTeeTime(firstTeeTime)}<br>
        <strong>Total Groups:</strong> ${groupNames.length}
      </p>
      
      <h2 style="color: #1e5631; margin-top: 32px;">Tee Sheet</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background: #1e5631; color: white;">
            <th style="padding: 12px; text-align: left;">Tee Time</th>
            <th style="padding: 12px; text-align: left;">Group</th>
            <th style="padding: 12px; text-align: left;">Players</th>
          </tr>
        </thead>
        <tbody>
          ${foursomeListHTML}
        </tbody>
      </table>
      
      <div style="margin-top: 32px; padding: 20px; background: #f9f9f9; border-left: 4px solid #1e5631;">
        <p style="margin: 0; font-size: 14px; color: #666;">
          <strong>Cart Tags:</strong> Please see the attached PDF file for printable cart tags. 
          Print and place one tag per golf cart. Each tag shows the players, tee time, and starting hole.
        </p>
      </div>

      <div style="margin-top: 16px; padding: 20px; background: #fff8e1; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>📍 Closest to the Pin Markers:</strong> Please provide Closest to the Pin markers on the designated par-3 holes for our tournament. Thank you!
        </p>
      </div>
      
      <p style="margin-top: 24px; font-size: 14px; color: #999;">
        If you have any questions, please contact us.<br>
        Thank you!
      </p>
    </div>
    
    <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; color: #999; font-size: 12px;">
        ${leagueName} &bull; ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;
    
    // Generate PDF from cart tags
    console.log('Generating PDF for cart tags...');
    const pdfHTML = generateCartTagsDocument(leagueName, pdfTags);
    
    let attachments = [];
    try {
      const pdfBuffer = await generatePDF(pdfHTML);
      
      if (!pdfBuffer || !pdfBuffer.length || typeof pdfBuffer.toString !== 'function') {
        throw new Error('PDF generation did not return a valid buffer');
      }
      
      // Ensure it's a proper Node Buffer
      const nodeBuffer = Buffer.from(pdfBuffer);
      const pdfBase64 = nodeBuffer.toString('base64');
      
      // Validate base64 (should only contain A-Z, a-z, 0-9, +, /, =)
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(pdfBase64)) {
        throw new Error('Generated base64 contains invalid characters');
      }
      
      console.log(`PDF generated successfully, size: ${nodeBuffer.length} bytes, base64 length: ${pdfBase64.length}`);
      console.log(`Base64 preview: ${pdfBase64.substring(0, 50)}...`);
      
      // Prepare PDF attachment
      attachments = [
        {
          content: pdfBase64,
          filename: `cart-tags-${tournamentDate.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ];
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      console.log('Continuing without PDF attachment...');
      // Continue without attachment - email will just have the tee sheet
    }

    const emailDelayMs = getOutgoingEmailDelayMs();
    if (emailDelayMs > 0) {
      await sleep(emailDelayMs);
    }
    
    await sendEmail(golfCourseEmails, subject, emailHTML, null, attachments, false);

    if (Array.isArray(golfCourseEmails) && golfCourseEmails.length > 1) {
      try {
        await sendEmail(GROUP_EMAIL_COPY_TO, subject, emailHTML, null, attachments, false);
      } catch (copyErr) {
        console.error('Failed to send single cart-tag email copy:', copyErr.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Tee sheet sent to ${golfCourseEmails.join('; ')}`,
      groups: groupNames.length
    });
    
  } catch (err) {
    console.error('Error sending cart tags:', err);
    res.status(500).json({ error: 'Failed to send cart tags email' });
  }
});

module.exports = router;
