const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendEmail } = require('../email');
const { generatePDF } = require('../pdf');

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

// Generate HTML for a single cart tag (7.5" x 5")
const generateCartTagHTML = (courseName, playerNames, teeTime, startingHole = 1) => {
  return `
    <div style="
      width: 7.5in;
      height: 5in;
      border: 3px solid #1e5631;
      padding: 0.4in;
      box-sizing: border-box;
      page-break-after: always;
      font-family: 'Georgia', serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    ">
      <div style="text-align: center;">
        <div style="
          font-size: 28px;
          font-weight: bold;
          color: #1e5631;
          letter-spacing: 1px;
          margin-bottom: 8px;
        ">PG/PARADISE GOLF<sup style="font-size: 14px;">®</sup></div>
        <div style="
          font-size: 16px;
          color: #333;
          margin-bottom: 24px;
          font-style: italic;
        ">${courseName}</div>
      </div>
      
      <div style="
        text-align: center;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      ">
        ${playerNames.map(name => `
          <div style="
            font-size: 42px;
            font-weight: bold;
            color: #1e5631;
            margin: 12px 0;
            line-height: 1.2;
          ">${name}</div>
        `).join('')}
      </div>
      
      <div style="
        display: flex;
        justify-content: space-between;
        font-size: 24px;
        font-weight: bold;
        color: #333;
      ">
        <div><span style="font-weight: normal;">Time:</span> ${teeTime}</div>
        <div><span style="font-weight: normal;">Hole:</span> ${startingHole}</div>
      </div>
    </div>
  `;
};

// Generate email-friendly cart tag using tables (email clients don't support flexbox)
const generateCartTagEmailHTML = (courseName, playerNames, teeTime, startingHole = 1) => {
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
            PG/PARADISE GOLF<sup style="font-size: 12px;">®</sup>
          </div>
          <div style="font-size: 14px; color: #333; font-style: italic; margin-top: 8px;">
            ${courseName}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding: 40px 20px; text-align: center;">
          ${playerNames.map(name => `
            <div style="font-size: 36px; font-weight: bold; color: #1e5631; margin: 15px 0; line-height: 1.2;">
              ${name}
            </div>
          `).join('')}
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
const generateCartTagsDocument = (tags) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cart Tags - Paradise Golf</title>
  <style>
    @page {
      size: letter;
      margin: 0.25in;
    }
    body {
      margin: 0;
      padding: 0;
    }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding: 20px; background: #f0f0f0; margin-bottom: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Print Cart Tags</button>
  </div>
  ${tags.join('\n')}
</body>
</html>`;
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
    
    // Get all foursome groups with players from both scores and tournament_players
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
    const [tpRows] = await pool.query(
      `SELECT tp.foursome_group, p.name as player_name
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       WHERE tp.tournament_id = ? AND tp.foursome_group IS NOT NULL
       GROUP BY tp.foursome_group, p.id
       ORDER BY tp.foursome_group, p.name`,
      [tournamentId]
    );

    tpRows.forEach(row => {
      if (!groups[row.foursome_group]) groups[row.foursome_group] = new Set();
      groups[row.foursome_group].add(row.player_name);
    });

    // Convert sets to arrays and ensure we have at least one group
    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
      return res.status(404).json({ error: 'No foursome groups found for this tournament' });
    }
    // transform to plain object with arrays
    const groupsArr = {};
    groupKeys.forEach(g => { groupsArr[g] = Array.from(groups[g]); });
    // use groupsArr going forward
    
    // Generate cart tags (2 players per cart typically)
    const tags = [];
    const groupNames = Object.keys(groupsArr).sort();
    
    groupNames.forEach((groupName, groupIndex) => {
      const players = groupsArr[groupName];
      const teeTime = formatTeeTime(firstTeeTime, groupIndex * 8); // 8 minute intervals
      
      // Extract starting hole from group name (e.g., "1" -> 1)
      const startingHole = parseInt(groupName) || 1;
      
      // Split into carts (2 players per cart)
      for (let i = 0; i < players.length; i += 2) {
        const cartPlayers = players.slice(i, i + 2);
        tags.push(generateCartTagHTML(courseName, cartPlayers, teeTime, startingHole));
      }
    });
    
    const html = generateCartTagsDocument(tags);
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
    const [settingsRows] = await pool.query('SELECT golf_course_email FROM settings LIMIT 1');
    const golfCourseEmail = settingsRows[0]?.golf_course_email;
    
    if (!golfCourseEmail) {
      return res.status(400).json({ error: 'Golf course email not configured in settings' });
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
    const tournamentDate = new Date(tournament.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Get all foursome groups with players from both scores and tournament_players
    const groups = {};

    // From scores table
    const [scoreRows2] = await pool.query(
      `SELECT s.foursome_group, p.name as player_name
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ? AND s.foursome_group IS NOT NULL
       GROUP BY s.foursome_group, p.id
       ORDER BY s.foursome_group, p.name`,
      [tournamentId]
    );

    scoreRows2.forEach(row => {
      if (!groups[row.foursome_group]) groups[row.foursome_group] = new Set();
      groups[row.foursome_group].add(row.player_name);
    });

    // From tournament_players table
    const [tpRows2] = await pool.query(
      `SELECT tp.foursome_group, p.name as player_name
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       WHERE tp.tournament_id = ? AND tp.foursome_group IS NOT NULL
       GROUP BY tp.foursome_group, p.id
       ORDER BY tp.foursome_group, p.name`,
      [tournamentId]
    );

    tpRows2.forEach(row => {
      if (!groups[row.foursome_group]) groups[row.foursome_group] = new Set();
      groups[row.foursome_group].add(row.player_name);
    });

    const groupsArr2 = {};
    Object.keys(groups).forEach(g => { groupsArr2[g] = Array.from(groups[g]); });
    const groupNames = Object.keys(groupsArr2).sort();
    
    // Build foursome list HTML
    let foursomeListHTML = '';
    groupNames.forEach((groupName, groupIndex) => {
      const players = groupsArr2[groupName];
      const teeTime = formatTeeTime(firstTeeTime, groupIndex * 8);
      
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
      const players = groupsArr2[groupName];
      const teeTime = formatTeeTime(firstTeeTime, groupIndex * 8);
      
      // Extract starting hole from group name (e.g., "1" -> 1)
      const startingHole = parseInt(groupName) || 1;
      
      for (let i = 0; i < players.length; i += 2) {
        const cartPlayers = players.slice(i, i + 2);
        emailTags.push(generateCartTagEmailHTML(courseName, cartPlayers, teeTime, startingHole));
        pdfTags.push(generateCartTagHTML(courseName, cartPlayers, teeTime, startingHole));
      }
    });
    
    // Create email
    const subject = `Paradise Golf - Tournament Tee Sheet for ${tournamentDate}`;
    const emailHTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="background: #1e5631; color: white; padding: 30px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">PG/PARADISE GOLF</h1>
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
      
      <p style="margin-top: 24px; font-size: 14px; color: #999;">
        If you have any questions, please contact us.<br>
        Thank you!
      </p>
    </div>
    
    <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; color: #999; font-size: 12px;">
      Paradise Golf &bull; ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;
    
    // Generate PDF from cart tags
    console.log('Generating PDF for cart tags...');
    const pdfHTML = generateCartTagsDocument(pdfTags);
    
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
    
    await sendEmail(golfCourseEmail, subject, emailHTML, null, attachments);
    
    res.json({ 
      success: true, 
      message: `Tee sheet sent to ${golfCourseEmail}`,
      groups: groupNames.length
    });
    
  } catch (err) {
    console.error('Error sending cart tags:', err);
    res.status(500).json({ error: 'Failed to send cart tags email' });
  }
});

module.exports = router;
