const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/admin');
const { sendSMS } = require('../twilio');
const { sendEmail } = require('../email');

const formatDateOnly = (value, locale = 'en-US', options = {}) => {
  if (!value) {
    return '';
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(locale, options);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString(locale, options);
};

const getTournamentQuotaColumn = (numberOfHoles) => (
  Number(numberOfHoles) === 9 ? 'quota_9' : 'quota_18'
);

const getLeagueId = (req) => req.league?.id || 1;

const ensureTournamentResultsEmailTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tournament_results_email (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tournament_id INT NOT NULL,
      subject VARCHAR(500),
      html MEDIUMTEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME DEFAULT NULL,
      UNIQUE KEY uq_tournament (tournament_id),
      INDEX idx_tournament_id (tournament_id)
    )
  `);
};

const recalculateAllPlayersPrizeMoney = async (db) => {
  const [settingsRows] = await db.query(
    'SELECT tournament_fee_18_holes, tournament_fee_9_holes FROM league_settings WHERE league_id = 1 LIMIT 1'
  );
  const settings = settingsRows[0] || {};

  const [tournaments] = await db.query('SELECT id, number_of_holes FROM tournament');
  const winningsByPlayer = new Map();
  const addWinnings = (playerId, amount) => {
    const numeric = Number(amount) || 0;
    if (!playerId || numeric === 0) return;
    winningsByPlayer.set(playerId, (winningsByPlayer.get(playerId) || 0) + numeric);
  };

  for (const tournament of tournaments) {
    const tournamentId = tournament.id;
    const holeCount = Number(tournament.number_of_holes) === 9 ? 9 : 18;
    const tournamentFee = Number(
      holeCount === 9 ? settings.tournament_fee_9_holes : settings.tournament_fee_18_holes
    ) || 0;

    const [paidRows] = await db.query(
      'SELECT SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) AS paid_players FROM tournament_players WHERE tournament_id = ?',
      [tournamentId]
    );
    const quotaPrizePot = (Number(paidRows[0]?.paid_players) || 0) * tournamentFee;

    const [paradiseRows] = await db.query(
      `SELECT player_id, over_under
       FROM tournament_paradise_points
       WHERE tournament_id = ?
       ORDER BY over_under DESC, player_id ASC`,
      [tournamentId]
    );

    const prizePercentages = [0.5, 0.3, 0.2];
    let currentPosition = 0;
    while (currentPosition < paradiseRows.length) {
      const currentOverUnder = Number(paradiseRows[currentPosition].over_under);
      let tiedCount = 1;

      while (
        currentPosition + tiedCount < paradiseRows.length &&
        Number(paradiseRows[currentPosition + tiedCount].over_under) === currentOverUnder
      ) {
        tiedCount++;
      }

      let pooledPrizePercentage = 0;
      for (let i = 0; i < tiedCount; i++) {
        const prizePosition = currentPosition + i;
        if (prizePosition < prizePercentages.length) {
          pooledPrizePercentage += prizePercentages[prizePosition];
        }
      }

      const prizePerPlayer = tiedCount > 0
        ? Math.floor(quotaPrizePot * (pooledPrizePercentage / tiedCount))
        : 0;

      for (let i = 0; i < tiedCount; i++) {
        const row = paradiseRows[currentPosition + i];
        addWinnings(row.player_id, prizePerPlayer);
      }

      currentPosition += tiedCount;
    }

    const [skinRows] = await db.query(
      `SELECT player_id, SUM(COALESCE(prize_money, 0)) AS total
       FROM tournament_skin_winners
       WHERE tournament_id = ?
       GROUP BY player_id`,
      [tournamentId]
    );
    skinRows.forEach((row) => addWinnings(row.player_id, row.total));

    const [ctpRows] = await db.query(
      `SELECT player_id, SUM(COALESCE(prize_money, 0)) AS total
       FROM tournament_ctp_winners
       WHERE tournament_id = ?
       GROUP BY player_id`,
      [tournamentId]
    );
    ctpRows.forEach((row) => addWinnings(row.player_id, row.total));
  }

  await db.query('UPDATE players SET prize_money = 0');
  for (const [playerId, total] of winningsByPlayer.entries()) {
    await db.query('UPDATE players SET prize_money = ? WHERE id = ?', [Number(total.toFixed(2)), playerId]);
  }
};

const saveTournamentQuotaSnapshot = async (db, tournamentId, playerId) => {
  const [rows] = await db.query(
    `SELECT CASE
              WHEN t.number_of_holes = 9 THEN p.quota_9
              ELSE p.quota_18
            END AS tournament_quota
     FROM tournament t
     JOIN players p ON p.id = ?
     WHERE t.id = ?
     LIMIT 1`,
    [playerId, tournamentId]
  );

  if (rows.length === 0) {
    return null;
  }

  const tournamentQuota = rows[0].tournament_quota;

  await db.query(
    `UPDATE tournament_players
     SET tournament_quota = COALESCE(tournament_quota, ?)
     WHERE player_id = ? AND tournament_id = ?`,
    [tournamentQuota, playerId, tournamentId]
  );

  return tournamentQuota;
};

const calculateSkinsByHole = (rows) => {
  const holeGroups = {};

  rows.forEach((score) => {
    if (!holeGroups[score.hole_id]) {
      holeGroups[score.hole_id] = {
        hole_id: score.hole_id,
        hole_number: score.hole_number,
        scores: []
      };
    }

    holeGroups[score.hole_id].scores.push({
      player_id: score.player_id,
      player_name: score.player_name,
      score: score.score
    });
  });

  return Object.values(holeGroups).flatMap((hole) => {
    const sortedScores = hole.scores.sort((a, b) => a.score - b.score);

    if (sortedScores.length === 0) {
      return [];
    }

    const bestScore = sortedScores[0].score;
    const winners = sortedScores.filter((entry) => entry.score === bestScore);

    if (winners.length !== 1) {
      return [];
    }

    return [{
      hole_id: hole.hole_id,
      hole_number: hole.hole_number,
      player_id: winners[0].player_id,
      player_name: winners[0].player_name,
      score: winners[0].score
    }];
  });
};

const calculateCtpWinnersByHole = (rows, numberOfHoles) => {
  const ctpByHole = {};

  rows.forEach((ctp) => {
    if (!ctpByHole[ctp.hole_number]) {
      ctpByHole[ctp.hole_number] = ctp;
    }
  });

  let winningHoles = Object.keys(ctpByHole)
    .map(Number)
    .sort((a, b) => a - b);

  if (Number(numberOfHoles) === 9) {
    winningHoles = winningHoles.slice(0, 2);
  }

  return winningHoles.map((holeNumber) => ctpByHole[holeNumber]);
};

const buildResultsEmailHTML = ({ tournamentDate, courseName, numberOfHoles, rankedPlayers, skinWinners, ctpWinners, skinPrizePerSkin, ctpPrizePerWinner, quotaPrizePot, dashboardTotals = [], customMessage = null }) => {
  const prizePercentages = [0.5, 0.3, 0.2];
  const prizePlayers = [];
  let i = 0;
  while (i < rankedPlayers.length) {
    const currentOverUnder = rankedPlayers[i].over_under;
    let tiedCount = 1;
    while (i + tiedCount < rankedPlayers.length && rankedPlayers[i + tiedCount].over_under === currentOverUnder) tiedCount++;
    let pooledPct = 0;
    for (let j = 0; j < tiedCount; j++) {
      const pos = i + j;
      if (pos < prizePercentages.length) pooledPct += prizePercentages[pos];
    }
    const prizePerPlayer = quotaPrizePot > 0 && pooledPct > 0 ? Math.floor(quotaPrizePot * (pooledPct / tiedCount)) : 0;
    for (let j = 0; j < tiedCount; j++) {
      prizePlayers.push({ ...rankedPlayers[i + j], rank: i + 1, quota_prize: prizePerPlayer });
    }
    i += tiedCount;
  }

  const leaderboardRows = prizePlayers.map((p, idx) => {
    const overUnder = p.over_under > 0 ? `+${p.over_under}` : `${p.over_under}`;
    const rankLabel = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank;
    const bold = p.rank <= 3 ? 'font-weight:bold;' : '';
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9f9f9';
    return `<tr style="background:${rowBg}">
      <td style="padding:8px 12px;text-align:center;${bold}">${rankLabel}</td>
      <td style="padding:8px 12px;${bold}">${p.name}</td>
      <td style="padding:8px 12px;text-align:center;">${p.total_points}</td>
      <td style="padding:8px 12px;text-align:center;color:${p.over_under >= 0 ? '#15803d' : '#dc2626'}">${overUnder}</td>
      <td style="padding:8px 12px;text-align:right;">${p.quota_prize > 0 ? '$' + p.quota_prize.toLocaleString() : '-'}</td>
    </tr>`;
  }).join('');

  const skinsSection = skinWinners.length > 0 ? `
    <div style="background:white;padding:20px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;margin-top:16px;">
      <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 12px 0;">🎯 Skins Winners</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f0f4f8;">
          <th style="padding:8px 12px;text-align:left;color:#555;">Hole</th>
          <th style="padding:8px 12px;text-align:left;color:#555;">Player</th>
          <th style="padding:8px 12px;text-align:center;color:#555;">Score</th>
          <th style="padding:8px 12px;text-align:right;color:#555;">Prize</th>
        </tr></thead>
        <tbody>${[...skinWinners].sort((a, b) => a.hole_number - b.hole_number).map((w, idx) =>
          `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
            <td style="padding:8px 12px;">Hole ${w.hole_number}</td>
            <td style="padding:8px 12px;">${w.player_name}</td>
            <td style="padding:8px 12px;text-align:center;">${w.score}</td>
            <td style="padding:8px 12px;text-align:right;">$${skinPrizePerSkin}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  const ctpSection = ctpWinners.length > 0 ? `
    <div style="background:white;padding:20px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;margin-top:16px;">
      <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 12px 0;">📍 Closest to Pin (CTP)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f0f4f8;">
          <th style="padding:8px 12px;text-align:left;color:#555;">Hole</th>
          <th style="padding:8px 12px;text-align:left;color:#555;">Player</th>
          <th style="padding:8px 12px;text-align:center;color:#555;">Distance</th>
          <th style="padding:8px 12px;text-align:right;color:#555;">Prize</th>
        </tr></thead>
        <tbody>${ctpWinners.map((w, idx) =>
          `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
            <td style="padding:8px 12px;">Hole ${w.hole_number}</td>
            <td style="padding:8px 12px;">${w.player_name}</td>
            <td style="padding:8px 12px;text-align:center;">${w.ctp_feet}'${w.ctp_inches}"</td>
            <td style="padding:8px 12px;text-align:right;">$${ctpPrizePerWinner}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  const dashboardSection = dashboardTotals.length > 0 ? `
    <div style="background:white;padding:20px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;margin-top:16px;">
      <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 12px 0;">📈 Paradise Cup & YTD Totals</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f0f4f8;">
          <th style="padding:8px 12px;text-align:left;color:#555;">Player</th>
          <th style="padding:8px 12px;text-align:center;color:#555;">Paradise Pts</th>
          <th style="padding:8px 12px;text-align:right;color:#555;">Total Prize Money YTD</th>
        </tr></thead>
        <tbody>${dashboardTotals.map((p, idx) =>
          `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
            <td style="padding:8px 12px;">${p.name}</td>
            <td style="padding:8px 12px;text-align:center;">${(Number(p.fedex_points) || 0).toLocaleString()}</td>
            <td style="padding:8px 12px;text-align:right;">$${(Number(p.prize_money) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  const customMessageSection = customMessage ? `
    <div style="background:#fffbeb;padding:16px 20px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-top:3px solid #f59e0b;">
      <p style="margin:0;color:#92400e;font-size:14px;line-height:1.6;white-space:pre-wrap;">${customMessage}</p>
    </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#1e3a5f;color:white;padding:24px 20px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="margin:0 0 8px 0;font-size:26px;">⛳ Tournament Results</h1>
    <p style="margin:0;font-size:16px;">${tournamentDate} &bull; ${courseName}</p>
    <p style="margin:4px 0 0 0;font-size:14px;opacity:0.85;">${numberOfHoles} Holes</p>
  </div>
  ${customMessageSection}
  <div style="background:white;padding:20px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
    <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 12px 0;">🏆 Quota Game Leaderboard</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f0f4f8;">
        <th style="padding:8px 12px;text-align:center;color:#555;">Rank</th>
        <th style="padding:8px 12px;text-align:left;color:#555;">Player</th>
        <th style="padding:8px 12px;text-align:center;color:#555;">Pts</th>
        <th style="padding:8px 12px;text-align:center;color:#555;">+/-</th>
        <th style="padding:8px 12px;text-align:right;color:#555;">Prize</th>
      </tr></thead>
      <tbody>${leaderboardRows}</tbody>
    </table>
  </div>
  ${skinsSection}
  ${ctpSection}
  ${dashboardSection}
  <div style="background:#1e3a5f;color:#cdd6e4;padding:14px 20px;border-radius:0 0 8px 8px;text-align:center;font-size:12px;">
    NPGolf &bull; ${new Date().getFullYear()}
  </div>
</div>
</body></html>`;
};

const insertRows = async (db, tableName, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]);
  if (columns.length === 0) {
    return;
  }

  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
  const placeholders = rows.map(() => rowPlaceholder).join(', ');
  const values = [];

  rows.forEach((row) => {
    columns.forEach((column) => {
      values.push(row[column] ?? null);
    });
  });

  await db.query(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`,
    values
  );
};

const createPreCompleteBackup = async (db, tournamentId) => {
  const [playerIdRows] = await db.query(
    'SELECT DISTINCT player_id FROM scores WHERE tournament_id = ? ORDER BY player_id ASC',
    [tournamentId]
  );

  const playerIds = playerIdRows.map((row) => Number(row.player_id)).filter((id) => Number.isInteger(id));
  const playerIdPlaceholders = playerIds.length > 0 ? playerIds.map(() => '?').join(', ') : '';

  const [tournamentRows] = await db.query(
    'SELECT * FROM tournament WHERE id = ? LIMIT 1',
    [tournamentId]
  );

  const [tournamentPlayersRows] = await db.query(
    'SELECT * FROM tournament_players WHERE tournament_id = ? ORDER BY player_id ASC',
    [tournamentId]
  );

  const [skinWinnerRows] = await db.query(
    'SELECT * FROM tournament_skin_winners WHERE tournament_id = ? ORDER BY hole_number ASC',
    [tournamentId]
  );

  const [ctpWinnerRows] = await db.query(
    'SELECT * FROM tournament_ctp_winners WHERE tournament_id = ? ORDER BY hole_number ASC',
    [tournamentId]
  );

  const [paradiseRows] = await db.query(
    'SELECT * FROM tournament_paradise_points WHERE tournament_id = ? ORDER BY place ASC, player_id ASC',
    [tournamentId]
  );

  let playerRows = [];
  let quotaRows = [];
  let skinsQuotaRows = [];

  if (playerIds.length > 0) {
    [playerRows] = await db.query(
      `SELECT id, quota_18, quota_9, fedex_points, tournaments_played, prize_money
       FROM players
       WHERE id IN (${playerIdPlaceholders})
       ORDER BY id ASC`,
      playerIds
    );

    [quotaRows] = await db.query(
      `SELECT *
       FROM quota
       WHERE player_id IN (${playerIdPlaceholders})
       ORDER BY player_id ASC`,
      playerIds
    );

    [skinsQuotaRows] = await db.query(
      `SELECT *
       FROM skins_quota
       WHERE player_id IN (${playerIdPlaceholders})
       ORDER BY player_id ASC`,
      playerIds
    );
  }

  const payload = {
    tournament: tournamentRows[0] || null,
    players: playerRows,
    quota: quotaRows,
    skins_quota: skinsQuotaRows,
    tournament_players: tournamentPlayersRows,
    tournament_skin_winners: skinWinnerRows,
    tournament_ctp_winners: ctpWinnerRows,
    tournament_paradise_points: paradiseRows
  };

  const [insertResult] = await db.query(
    `INSERT INTO tournament_completion_backups (tournament_id, backup_data)
     VALUES (?, ?)`,
    [tournamentId, JSON.stringify(payload)]
  );

  return insertResult.insertId;
};

// GET /api/tournaments - List all tournaments
router.get('/', async (req, res) => {
  try {
      const leagueId = getLeagueId(req);
      const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.nine_hole_side, t.created_at, t.completed,
              c.id as course_id, c.name as course_name, c.address as course_address,
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM tournament_paradise_points tp
                  WHERE tp.tournament_id = t.id
                ) THEN 1
                ELSE 0
              END AS is_completed
       FROM tournament t
       JOIN course c ON t.course_id = c.id
         WHERE t.league_id = ?
       ORDER BY t.date DESC`
      , [leagueId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// GET /api/tournaments/upcoming - Get next 3 upcoming tournaments
router.get('/upcoming', async (req, res) => {
  try {
      const leagueId = getLeagueId(req);
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.nine_hole_side, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
         WHERE t.league_id = ? AND t.date >= CURDATE()
       ORDER BY t.date ASC
       LIMIT 3`
      , [leagueId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching upcoming tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming tournaments' });
  }
});
// GET /api/tournaments/next - Get next upcoming tournament
router.get('/next', async (req, res) => {
  try {
      const leagueId = getLeagueId(req);
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.course_id, t.number_of_holes, t.nine_hole_side, t.first_tee_time, t.created_at,
              c.name as course_name, c.address as course_address, c.phone as course_phone
       FROM tournament t
       JOIN course c ON t.course_id = c.id
         WHERE t.league_id = ? AND t.date >= CURDATE()
       ORDER BY t.date ASC
       LIMIT 1`
      , [leagueId]
    );
    if (rows.length === 0) {
      return res.json(null);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching next tournament:', err);
    res.status(500).json({ error: 'Failed to fetch next tournament' });
  }
});
// GET /api/tournaments/:id - Get single tournament
router.get('/:id', async (req, res) => {
  try {
    const leagueId = getLeagueId(req);
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.nine_hole_side, t.created_at,
              t.quota_collected, t.skins_collected,
              c.id as course_id, c.name as course_name, c.address as course_address, c.phone as course_phone,
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM tournament_paradise_points tp
                  WHERE tp.tournament_id = t.id
                ) THEN 1
                ELSE 0
              END AS is_completed
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ? AND t.league_id = ?`,
      [req.params.id, leagueId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching tournament:', err);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// PUT /api/tournaments/:id/collected - Save actual collected amounts for reconciliation
router.put('/:id/collected', async (req, res) => {
  try {
    const { quota_collected, skins_collected } = req.body;
    await pool.query(
      'UPDATE tournament SET quota_collected = ?, skins_collected = ? WHERE id = ?',
      [
        quota_collected != null && quota_collected !== '' ? Number(quota_collected) : null,
        skins_collected != null && skins_collected !== '' ? Number(skins_collected) : null,
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating collected amounts:', err);
    res.status(500).json({ error: 'Failed to update collected amounts' });
  }
});

// POST /api/tournaments - Create tournament
router.post('/', async (req, res) => {
  try {
    const { date, course_id, number_of_holes, nine_hole_side } = req.body;
    const leagueId = getLeagueId(req);
    const holeCount = Number(number_of_holes || 18);
    const side = holeCount === 9 && nine_hole_side === 'back' ? 'back' : 'front';
    const [result] = await pool.query(
      'INSERT INTO tournament (date, course_id, number_of_holes, nine_hole_side, league_id) VALUES (?, ?, ?, ?, ?)',
      [date, course_id, holeCount, side, leagueId]
    );
    res.status(201).json({ id: result.insertId, date, course_id, number_of_holes: holeCount, nine_hole_side: side, league_id: leagueId });
  } catch (err) {
    console.error('Error creating tournament:', err);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// PUT /api/tournaments/:id - Update tournament
router.put('/:id', async (req, res) => {
  try {
    const leagueId = getLeagueId(req);
    const { date, course_id, number_of_holes, nine_hole_side } = req.body;
    const holeCount = Number(number_of_holes || 18);
    const side = holeCount === 9 && nine_hole_side === 'back' ? 'back' : 'front';
    await pool.query(
      'UPDATE tournament SET date = ?, course_id = ?, number_of_holes = ?, nine_hole_side = ? WHERE id = ? AND league_id = ?',
      [date, course_id, holeCount, side, req.params.id, leagueId]
    );
    res.json({ id: req.params.id, date, course_id, number_of_holes: holeCount, nine_hole_side: side });
  } catch (err) {
    console.error('Error updating tournament:', err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// DELETE /api/tournaments/:id - Delete tournament
router.delete('/:id', async (req, res) => {
  try {
  const leagueId = getLeagueId(req);
  await pool.query('DELETE FROM tournament WHERE id = ? AND league_id = ?', [req.params.id, leagueId]);
    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    console.error('Error deleting tournament:', err);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

// POST /api/tournaments/:id/complete - Complete tournament and update quota history
router.post('/:id/complete', async (req, res) => {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const tournamentId = req.params.id;
    
    // Get tournament date and course
    const [tournamentRows] = await connection.query(
      `SELECT t.date, t.number_of_holes, t.league_id, c.name AS course_name
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    
    if (tournamentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournamentDate = tournamentRows[0].date;
    const tournamentHoleCount = Number(tournamentRows[0].number_of_holes) === 9 ? 9 : 18;
    const leagueId = tournamentRows[0].league_id;
    const isNineHoleTournament = tournamentHoleCount === 9;
    const quotaColumn = isNineHoleTournament ? 'p.quota_9' : 'p.quota_18';

    // Load quota point values from league settings (fall back to system defaults)
    const [settingsRows] = await connection.query(
      `SELECT quota_points_albatross, quota_points_eagle, quota_points_birdie,
              quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse
       FROM league_settings WHERE league_id = ? LIMIT 1`,
      [leagueId]
    );
    const qp = settingsRows.length > 0 ? settingsRows[0] : {};
    const pts = {
      albatross: Number.isInteger(qp.quota_points_albatross) ? qp.quota_points_albatross : 8,
      eagle: Number.isInteger(qp.quota_points_eagle) ? qp.quota_points_eagle : 8,
      birdie: Number.isInteger(qp.quota_points_birdie) ? qp.quota_points_birdie : 6,
      par: Number.isInteger(qp.quota_points_par) ? qp.quota_points_par : 4,
      bogey: Number.isInteger(qp.quota_points_bogey) ? qp.quota_points_bogey : 2,
      double_bogey: Number.isInteger(qp.quota_points_double_bogey) ? qp.quota_points_double_bogey : 1,
      worse: Number.isInteger(qp.quota_points_worse) ? qp.quota_points_worse : 0
    };

    const [scoreCountRows] = await connection.query(
      'SELECT COUNT(*) AS score_count FROM scores WHERE tournament_id = ?',
      [tournamentId]
    );

    if (scoreCountRows[0].score_count === 0) {
      return res.status(400).json({ error: 'No scores found for this tournament' });
    }

    const backupId = await createPreCompleteBackup(connection, tournamentId);
    console.log(`Tournament completion backup created: tournamentId=${tournamentId}, backupId=${backupId}`);

    await connection.beginTransaction();
    transactionStarted = true;
    
    // Include all scored players in quota-game updates
    const [scoresRows] = await connection.query(
      `SELECT s.player_id, ${quotaColumn} AS current_quota, SUM(CAST(COALESCE(s.quota, 0) AS SIGNED)) as total_points
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ?
       GROUP BY s.player_id, ${quotaColumn}`,
      [tournamentId]
    );

    // Seed quota for players who played but do not yet have a current quota
    // Effective par: player's assigned tee -> gender-appropriate fallback tee
    const [newPlayerSeedRows] = await connection.query(
      `SELECT
         s.player_id,
         SUM(
           CASE
             WHEN CAST(s.score AS SIGNED) = 1 THEN ${pts.albatross}
             WHEN CAST(s.score AS SIGNED) - CAST(COALESCE(ht.par, ht_fb.par) AS SIGNED) <= -3 THEN ${pts.albatross}
             WHEN CAST(s.score AS SIGNED) - CAST(COALESCE(ht.par, ht_fb.par) AS SIGNED) = -2 THEN ${pts.eagle}
             WHEN CAST(s.score AS SIGNED) - CAST(COALESCE(ht.par, ht_fb.par) AS SIGNED) = -1 THEN ${pts.birdie}
             WHEN CAST(s.score AS SIGNED) - CAST(COALESCE(ht.par, ht_fb.par) AS SIGNED) = 0 THEN ${pts.par}
             WHEN CAST(s.score AS SIGNED) - CAST(COALESCE(ht.par, ht_fb.par) AS SIGNED) = 1 THEN ${pts.bogey}
             WHEN CAST(s.score AS SIGNED) - CAST(COALESCE(ht.par, ht_fb.par) AS SIGNED) = 2 THEN ${pts.double_bogey}
             ELSE ${pts.worse}
           END
         ) AS seeded_quota
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN hole h ON s.hole_id = h.id
       LEFT JOIN tournament_players tp_inner
         ON tp_inner.player_id = s.player_id AND tp_inner.tournament_id = s.tournament_id
       LEFT JOIN hole_tee ht ON ht.hole_id = h.id AND ht.tee_id = tp_inner.tee_id
       LEFT JOIN hole_tee ht_fb ON ht_fb.id = (
         SELECT ht3.id FROM hole_tee ht3
         JOIN course_tee ct3 ON ct3.id = ht3.tee_id
         WHERE ht3.hole_id = h.id
           AND ct3.gender = CASE WHEN p.sex = 'F' THEN 'F' ELSE 'M' END
         ORDER BY ct3.id ASC LIMIT 1
       )
       WHERE s.tournament_id = ?
         AND ${quotaColumn} IS NULL
       GROUP BY s.player_id`,
      [tournamentId]
    );

    for (const seedRow of newPlayerSeedRows) {
      const seededQuota = Number(seedRow.seeded_quota)
      if (Number.isNaN(seededQuota)) continue

      await connection.query(
        `UPDATE players
         SET ${isNineHoleTournament ? 'quota_9' : 'quota_18'} = ?
         WHERE id = ?
           AND ${isNineHoleTournament ? 'quota_9' : 'quota_18'} IS NULL`,
        [Math.round(seededQuota), seedRow.player_id]
      )
    }

    await connection.query(
      `UPDATE tournament_players tp
       JOIN players p ON p.id = tp.player_id
       SET tp.tournament_quota = CASE
         WHEN ? = 9 THEN p.quota_9
         ELSE p.quota_18
       END
       WHERE tp.tournament_id = ?
         AND tp.tournament_quota IS NULL`,
      [tournamentHoleCount, tournamentId]
    );

    const [scoresRowsWithSnapshot] = await connection.query(
          `SELECT s.player_id,
            p.name,
              COALESCE(tp.tournament_quota, ${quotaColumn}) AS current_quota,
              SUM(CAST(COALESCE(s.quota, 0) AS SIGNED)) AS total_points
       FROM scores s
       JOIN players p ON s.player_id = p.id
       LEFT JOIN tournament_players tp
         ON tp.player_id = s.player_id
        AND tp.tournament_id = s.tournament_id
       WHERE s.tournament_id = ?
       GROUP BY s.player_id, p.name, COALESCE(tp.tournament_quota, ${quotaColumn})`,
      [tournamentId]
    );

    const rankedPlayers = scoresRowsWithSnapshot
      .map((row) => {
        const totalPoints = Number(row.total_points) || 0;
        const playerQuota = Number(row.current_quota) || 0;
        return {
          player_id: row.player_id,
          name: row.name,
          total_points: totalPoints,
          player_quota: playerQuota,
          over_under: totalPoints - playerQuota
        };
      })
      .sort((a, b) => {
        if (b.over_under !== a.over_under) return b.over_under - a.over_under;
        return String(a.name).localeCompare(String(b.name));
      });

    await connection.query('DELETE FROM tournament_paradise_points WHERE tournament_id = ?', [tournamentId]);

    for (let index = 0; index < rankedPlayers.length; index++) {
      const player = rankedPlayers[index];
      const place = index + 1;
      const pointsAwarded = place <= 10 ? (110 - place * 10) : 1;

      await connection.query(
        `INSERT INTO tournament_paradise_points
           (tournament_id, player_id, place, total_quota_points, player_quota, over_under, points_awarded)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tournamentId,
          player.player_id,
          place,
          player.total_points,
          player.player_quota,
          player.over_under,
          pointsAwarded
        ]
      );
    }

    await connection.query(
      `UPDATE players p
       LEFT JOIN (
         SELECT
           player_id,
           SUM(points_awarded) AS total_points,
           COUNT(*) AS total_tournaments
         FROM tournament_paradise_points
         GROUP BY player_id
       ) awards ON awards.player_id = p.id
       SET p.fedex_points = COALESCE(awards.total_points, 0),
           p.tournaments_played = COALESCE(awards.total_tournaments, 0)`
    );

    const [skinScoreRows] = await connection.query(
      `SELECT s.hole_id,
              h.hole_number,
              s.player_id,
              s.score,
              p.name AS player_name
       FROM scores s
       JOIN hole h ON s.hole_id = h.id
       JOIN players p ON s.player_id = p.id
       JOIN tournament_players tp ON tp.tournament_id = s.tournament_id AND tp.player_id = s.player_id
       WHERE s.tournament_id = ?
         AND p.active = 1
         AND tp.skins_ctp_paid = 1
       ORDER BY s.hole_id, s.score ASC`,
      [tournamentId]
    );

    const skinWinners = calculateSkinsByHole(skinScoreRows);

    const [ctpRows] = await connection.query(
      `SELECT h.id AS hole_id,
              h.hole_number,
              s.player_id,
              p.name AS player_name,
              s.ctp_feet,
              s.ctp_inches,
              s.ctp_image_url,
              (s.ctp_feet * 12 + s.ctp_inches) AS total_inches
       FROM scores s
       JOIN hole h ON s.hole_id = h.id
       JOIN players p ON s.player_id = p.id
       JOIN tournament_players tp ON tp.tournament_id = s.tournament_id AND tp.player_id = s.player_id
       WHERE s.tournament_id = ?
         AND EXISTS (
           SELECT 1 FROM hole_tee ht_p3
           WHERE ht_p3.hole_id = h.id AND ht_p3.par = 3
         )
         AND s.ctp_feet IS NOT NULL
         AND p.active = 1
         AND tp.skins_ctp_paid = 1
       ORDER BY h.hole_number, total_inches ASC`,
      [tournamentId]
    );

    const ctpWinners = calculateCtpWinnersByHole(ctpRows, tournamentHoleCount);

    const [paidCountsRows] = await connection.query(
      `SELECT
         SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) AS paid_players,
         SUM(CASE WHEN skins_ctp_paid = 1 THEN 1 ELSE 0 END) AS skins_ctp_paid_players
       FROM tournament_players
       WHERE tournament_id = ?`,
      [tournamentId]
    );

    const [feeSettingsRows] = await connection.query(
      'SELECT tournament_fee_18_holes, tournament_fee_9_holes, skins_ctp_fee_18_holes, skins_ctp_fee_9_holes FROM league_settings WHERE league_id = ? LIMIT 1',
      [getLeagueId(req)]
    );

    const paidCounts = paidCountsRows[0] || {};
    const settings = feeSettingsRows[0] || {};
    const skinsCTPFee = Number(
      tournamentHoleCount === 18 ? settings.skins_ctp_fee_18_holes : settings.skins_ctp_fee_9_holes
    ) || 0;
    const skinsCTPTotalPot = (Number(paidCounts.skins_ctp_paid_players) || 0) * skinsCTPFee;
    const skinPrizePot = skinsCTPTotalPot * 0.6;
    const ctpPrizePot = skinsCTPTotalPot * 0.4;
    const skinPrizePerSkin = skinWinners.length > 0 ? Math.floor(skinPrizePot / skinWinners.length) : 0;
    const ctpPrizePerWinner = ctpWinners.length > 0 ? Math.floor(ctpPrizePot / ctpWinners.length) : 0;

    const tournamentFee = Number(
      tournamentHoleCount === 18 ? settings.tournament_fee_18_holes : settings.tournament_fee_9_holes
    ) || 0;
    const quotaPrizePot = (Number(paidCounts.paid_players) || 0) * tournamentFee;

    await connection.query('DELETE FROM tournament_skin_winners WHERE tournament_id = ?', [tournamentId]);
    await connection.query('DELETE FROM tournament_ctp_winners WHERE tournament_id = ?', [tournamentId]);

    for (const winner of skinWinners) {
      await connection.query(
        `INSERT INTO tournament_skin_winners (tournament_id, hole_id, hole_number, player_id, score, prize_money)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tournamentId, winner.hole_id, winner.hole_number, winner.player_id, winner.score, skinPrizePerSkin]
      );
    }

    for (const winner of ctpWinners) {
      await connection.query(
        `INSERT INTO tournament_ctp_winners (tournament_id, hole_id, hole_number, player_id, ctp_feet, ctp_inches, ctp_image_url, prize_money)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tournamentId,
          winner.hole_id,
          winner.hole_number,
          winner.player_id,
          winner.ctp_feet,
          winner.ctp_inches,
          winner.ctp_image_url,
          ctpPrizePerWinner
        ]
      );
    }

    // For each player, shift quota history and add new result, then recalculate quota as floor average
    for (const player of scoresRowsWithSnapshot) {
      const playerId = player.player_id;
      const totalPoints = player.total_points;
      const currentQuota = Number(player.current_quota);
      const quotaDiff = Number(totalPoints) - (Number.isNaN(currentQuota) ? 0 : currentQuota);

      // Get current quota record for this player
      const [quotaRows] = await connection.query(
        'SELECT * FROM quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );

      if (quotaRows.length === 0) {
        // Create new quota record with tournament result in slot 1
        await connection.query(
          `INSERT INTO quota (player_id, league_id, date_1, points_1, quota_diff_1, holes_1)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [playerId, leagueId, tournamentDate, totalPoints, quotaDiff, tournamentHoleCount]
        );
      } else {
        // Shift: 6→7, 5→6, 4→5, 3→4, 2→3, 1→2, new tournament→1
        const quota = quotaRows[0];
        await connection.query(
          `UPDATE quota SET
            date_7 = ?, points_7 = ?, quota_diff_7 = ?, holes_7 = ?,
            date_6 = ?, points_6 = ?, quota_diff_6 = ?, holes_6 = ?,
            date_5 = ?, points_5 = ?, quota_diff_5 = ?, holes_5 = ?,
            date_4 = ?, points_4 = ?, quota_diff_4 = ?, holes_4 = ?,
            date_3 = ?, points_3 = ?, quota_diff_3 = ?, holes_3 = ?,
            date_2 = ?, points_2 = ?, quota_diff_2 = ?, holes_2 = ?,
            date_1 = ?, points_1 = ?, quota_diff_1 = ?, holes_1 = ?
           WHERE player_id = ?`,
          [
            quota.date_6, quota.points_6, quota.quota_diff_6, quota.holes_6,
            quota.date_5, quota.points_5, quota.quota_diff_5, quota.holes_5,
            quota.date_4, quota.points_4, quota.quota_diff_4, quota.holes_4,
            quota.date_3, quota.points_3, quota.quota_diff_3, quota.holes_3,
            quota.date_2, quota.points_2, quota.quota_diff_2, quota.holes_2,
            quota.date_1, quota.points_1, quota.quota_diff_1, quota.holes_1,
            tournamentDate, totalPoints, quotaDiff, tournamentHoleCount,
            playerId
          ]
        );
      }

      // Recompute player quota = floor(average of all non-null points slots 1-7)
      const [updatedQuotaRows] = await connection.query(
        'SELECT points_1, points_2, points_3, points_4, points_5, points_6, points_7 FROM quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );
      if (updatedQuotaRows.length > 0) {
        const q = updatedQuotaRows[0];
        const values = [q.points_1, q.points_2, q.points_3, q.points_4, q.points_5, q.points_6, q.points_7]
          .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
          .map(v => Number(v));
        if (values.length > 0) {
          const newQuota = Math.floor(values.reduce((sum, v) => sum + v, 0) / values.length);
          await connection.query(
            `UPDATE players SET ${isNineHoleTournament ? 'quota_9' : 'quota_18'} = ? WHERE id = ?`,
            [newQuota, playerId]
          );
        }
      }
    }
    
    // Now do the same for skins_quota (20 slots instead of 7)
    for (const player of scoresRowsWithSnapshot) {
      const playerId = player.player_id;
      const totalPoints = player.total_points;
      const currentQuota = Number(player.current_quota);
      const quotaDiff = Number(totalPoints) - (Number.isNaN(currentQuota) ? 0 : currentQuota);
      
      // Get current skins_quota record for this player
      const [skinsQuotaRows] = await connection.query(
        'SELECT * FROM skins_quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );
      
      if (skinsQuotaRows.length === 0) {
        // Create new skins_quota record with tournament result in slot 1
        await connection.query(
          `INSERT INTO skins_quota (player_id, league_id, date_1, points_1, quota_diff_1)
           VALUES (?, ?, ?, ?, ?)`,
          [playerId, leagueId, tournamentDate, totalPoints, quotaDiff]
        );
      } else {
        // Shift existing data: 19->20, 18->19, ..., 1->2, and new->1
        const sq = skinsQuotaRows[0];
        await connection.query(
          `UPDATE skins_quota SET
            date_20 = ?, points_20 = ?, quota_diff_20 = ?,
            date_19 = ?, points_19 = ?, quota_diff_19 = ?,
            date_18 = ?, points_18 = ?, quota_diff_18 = ?,
            date_17 = ?, points_17 = ?, quota_diff_17 = ?,
            date_16 = ?, points_16 = ?, quota_diff_16 = ?,
            date_15 = ?, points_15 = ?, quota_diff_15 = ?,
            date_14 = ?, points_14 = ?, quota_diff_14 = ?,
            date_13 = ?, points_13 = ?, quota_diff_13 = ?,
            date_12 = ?, points_12 = ?, quota_diff_12 = ?,
            date_11 = ?, points_11 = ?, quota_diff_11 = ?,
            date_10 = ?, points_10 = ?, quota_diff_10 = ?,
            date_9 = ?, points_9 = ?, quota_diff_9 = ?,
            date_8 = ?, points_8 = ?, quota_diff_8 = ?,
            date_7 = ?, points_7 = ?, quota_diff_7 = ?,
            date_6 = ?, points_6 = ?, quota_diff_6 = ?,
            date_5 = ?, points_5 = ?, quota_diff_5 = ?,
            date_4 = ?, points_4 = ?, quota_diff_4 = ?,
            date_3 = ?, points_3 = ?, quota_diff_3 = ?,
            date_2 = ?, points_2 = ?, quota_diff_2 = ?,
            date_1 = ?, points_1 = ?, quota_diff_1 = ?
           WHERE player_id = ?`,
          [
            sq.date_19, sq.points_19, sq.quota_diff_19,
            sq.date_18, sq.points_18, sq.quota_diff_18,
            sq.date_17, sq.points_17, sq.quota_diff_17,
            sq.date_16, sq.points_16, sq.quota_diff_16,
            sq.date_15, sq.points_15, sq.quota_diff_15,
            sq.date_14, sq.points_14, sq.quota_diff_14,
            sq.date_13, sq.points_13, sq.quota_diff_13,
            sq.date_12, sq.points_12, sq.quota_diff_12,
            sq.date_11, sq.points_11, sq.quota_diff_11,
            sq.date_10, sq.points_10, sq.quota_diff_10,
            sq.date_9, sq.points_9, sq.quota_diff_9,
            sq.date_8, sq.points_8, sq.quota_diff_8,
            sq.date_7, sq.points_7, sq.quota_diff_7,
            sq.date_6, sq.points_6, sq.quota_diff_6,
            sq.date_5, sq.points_5, sq.quota_diff_5,
            sq.date_4, sq.points_4, sq.quota_diff_4,
            sq.date_3, sq.points_3, sq.quota_diff_3,
            sq.date_2, sq.points_2, sq.quota_diff_2,
            sq.date_1, sq.points_1, sq.quota_diff_1,
            tournamentDate, totalPoints, quotaDiff,
            playerId
          ]
        );
      }
    }
    
    await connection.commit();
    transactionStarted = false;
    console.log(`Tournament completion applied: tournamentId=${tournamentId}, backupId=${backupId}`);

    // Generate and store results email (non-fatal)
    try {
      await ensureTournamentResultsEmailTable(pool);
      const tournamentDate = formatDateOnly(tournamentRows[0].date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const courseName = tournamentRows[0].course_name || 'Unknown Course';
      await recalculateAllPlayersPrizeMoney(pool);
      const rankedPlayerIds = [...new Set(rankedPlayers.map((p) => p.player_id).filter(Boolean))];
      let dashboardTotals = [];
      if (rankedPlayerIds.length > 0) {
        const placeholders = rankedPlayerIds.map(() => '?').join(', ');
        const [dashboardRows] = await pool.query(
          `SELECT id AS player_id, name, fedex_points, prize_money
           FROM players
           WHERE id IN (${placeholders})
           ORDER BY fedex_points DESC, name ASC`,
          rankedPlayerIds
        );
        dashboardTotals = dashboardRows;
      }
      const emailHTML = buildResultsEmailHTML({
        tournamentDate,
        courseName,
        numberOfHoles: tournamentHoleCount,
        rankedPlayers,
        skinWinners,
        ctpWinners,
        skinPrizePerSkin,
        ctpPrizePerWinner,
        quotaPrizePot,
        dashboardTotals,
        customMessage: req.body?.customMessage || null
      });
      const emailSubject = `NPGolf Tournament Results - ${tournamentDate}`;
      await pool.query(
        `INSERT INTO tournament_results_email (tournament_id, subject, html, generated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE subject = VALUES(subject), html = VALUES(html), generated_at = NOW(), sent_at = NULL`,
        [tournamentId, emailSubject, emailHTML]
      );
      console.log(`Results email generated for tournament ${tournamentId}`);
    } catch (emailErr) {
      console.error('Error generating results email (non-fatal):', emailErr);
    }

    res.json({
      message: 'Tournament completed successfully',
      playersUpdated: scoresRowsWithSnapshot.length,
      playersSeeded: newPlayerSeedRows.length,
      paradisePointsAwarded: rankedPlayers.length,
      backupId
    });
    
  } catch (err) {
    if (transactionStarted) {
      await connection.rollback();
    }
    console.error('Error completing tournament:', err);
    res.status(500).json({ error: 'Failed to complete tournament' });
  } finally {
    connection.release();
  }
});

// POST /api/tournaments/:id/results-email/generate - Build and store results email from existing completion data
// Optional body: { customMessage: string }
router.post('/:id/results-email/generate', requireAdmin, async (req, res) => {
  const tournamentId = req.params.id;
  const { customMessage } = req.body || {};
  try {
    await ensureTournamentResultsEmailTable(pool);
    const [tournamentRows] = await pool.query(
      `SELECT t.date, t.number_of_holes, c.name AS course_name
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const { date, number_of_holes, course_name } = tournamentRows[0];
    const tournamentHoleCount = Number(number_of_holes) === 9 ? 9 : 18;

    const [paradiseRows] = await pool.query(
      `SELECT pp.player_id, pp.place, pp.over_under, pp.total_quota_points, pp.player_quota, p.name
       FROM tournament_paradise_points pp
       JOIN players p ON p.id = pp.player_id
       WHERE pp.tournament_id = ?
       ORDER BY pp.place ASC`,
      [tournamentId]
    );
    if (paradiseRows.length === 0) return res.status(400).json({ error: 'No completion data found — complete the tournament first' });

    const rankedPlayers = paradiseRows.map(r => ({
      player_id: r.player_id,
      name: r.name,
      total_points: Number(r.total_quota_points),
      player_quota: Number(r.player_quota),
      over_under: Number(r.over_under)
    }));

    // Prize money is already calculated during tournament completion — no need to recalculate here.
    const rankedPlayerIds = [...new Set(rankedPlayers.map((p) => p.player_id).filter(Boolean))];
    let dashboardTotals = [];
    if (rankedPlayerIds.length > 0) {
      const placeholders = rankedPlayerIds.map(() => '?').join(', ');
      const [dashboardRows] = await pool.query(
        `SELECT id AS player_id, name, fedex_points, prize_money
         FROM players
         WHERE id IN (${placeholders})
         ORDER BY fedex_points DESC, name ASC`,
        rankedPlayerIds
      );
      dashboardTotals = dashboardRows;
    }

    const [skinRows] = await pool.query(
      `SELECT sw.hole_number, sw.score, sw.prize_money, p.name AS player_name
       FROM tournament_skin_winners sw
       JOIN players p ON p.id = sw.player_id
       WHERE sw.tournament_id = ?
       ORDER BY sw.hole_number ASC`,
      [tournamentId]
    );
    const skinPrizePerSkin = skinRows.length > 0 ? Number(skinRows[0].prize_money) : 0;

    const [ctpRows] = await pool.query(
      `SELECT cw.hole_number, cw.ctp_feet, cw.ctp_inches, cw.prize_money, p.name AS player_name
       FROM tournament_ctp_winners cw
       JOIN players p ON p.id = cw.player_id
       WHERE cw.tournament_id = ?
       ORDER BY cw.hole_number ASC`,
      [tournamentId]
    );
    const ctpPrizePerWinner = ctpRows.length > 0 ? Number(ctpRows[0].prize_money) : 0;

    const [paidCountsRows] = await pool.query(
      `SELECT SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) AS paid_players FROM tournament_players WHERE tournament_id = ?`,
      [tournamentId]
    );
    const [settingsRows] = await pool.query(
      'SELECT tournament_fee_18_holes, tournament_fee_9_holes FROM league_settings WHERE league_id = ? LIMIT 1',
      [getLeagueId(req)]
    );
    const settings = settingsRows[0] || {};
    const tournamentFee = Number(tournamentHoleCount === 18 ? settings.tournament_fee_18_holes : settings.tournament_fee_9_holes) || 0;
    const quotaPrizePot = (Number(paidCountsRows[0]?.paid_players) || 0) * tournamentFee;

    const tournamentDate = formatDateOnly(date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const emailHTML = buildResultsEmailHTML({
      tournamentDate,
      courseName: course_name,
      numberOfHoles: tournamentHoleCount,
      rankedPlayers,
      skinWinners: skinRows,
      ctpWinners: ctpRows,
      skinPrizePerSkin,
      ctpPrizePerWinner,
      quotaPrizePot,
      dashboardTotals,
      customMessage: customMessage || null
    });
    const emailSubject = `NPGolf Tournament Results - ${tournamentDate}`;

    await pool.query(
      `INSERT INTO tournament_results_email (tournament_id, subject, html, generated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE subject = VALUES(subject), html = VALUES(html), generated_at = NOW(), sent_at = NULL`,
      [tournamentId, emailSubject, emailHTML]
    );

    res.json({ subject: emailSubject, html: emailHTML, generated_at: new Date().toISOString(), sent_at: null });
  } catch (err) {
    console.error('Error generating results email:', err);
    res.status(500).json({ error: 'Failed to generate results email' });
  }
});

// GET /api/tournaments/:id/results-email - Retrieve stored results email
router.get('/:id/results-email', requireAdmin, async (req, res) => {
  const tournamentId = req.params.id;
  try {
    await ensureTournamentResultsEmailTable(pool);
    const [rows] = await pool.query(
      'SELECT id, tournament_id, subject, html, generated_at, sent_at FROM tournament_results_email WHERE tournament_id = ?',
      [tournamentId]
    );
    if (rows.length === 0) {
      const [completionRows] = await pool.query(
        'SELECT COUNT(*) AS completed_rows FROM tournament_paradise_points WHERE tournament_id = ?',
        [tournamentId]
      );
      const isCompleted = Number(completionRows[0]?.completed_rows || 0) > 0;

      if (!isCompleted) {
        return res.status(400).json({ error: 'Tournament is not complete yet' });
      }

      return res.status(404).json({ error: 'No results email found for this tournament' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching results email:', err);
    res.status(500).json({ error: 'Failed to fetch results email' });
  }
});

// POST /api/tournaments/:id/results-email/send - Send stored results email to all eligible players (or one if email provided)
router.post('/:id/results-email/send', requireAdmin, async (req, res) => {
  const tournamentId = req.params.id;
  const { email: singleEmail } = req.body || {};
  try {
    await ensureTournamentResultsEmailTable(pool);
    const [emailRows] = await pool.query(
      'SELECT subject, html FROM tournament_results_email WHERE tournament_id = ?',
      [tournamentId]
    );
    if (emailRows.length === 0) return res.status(404).json({ error: 'No results email found for this tournament' });
    const { subject, html } = emailRows[0];

    let recipients;
    if (singleEmail) {
      recipients = [{ email: singleEmail }];
    } else {
      const [players] = await pool.query(
        `SELECT email FROM players WHERE active = 1 AND email IS NOT NULL AND email != '' AND email_allowed = 1`
      );
      recipients = players;
    }

    let sent = 0;
    const failed = [];
    for (let i = 0; i < recipients.length; i++) {
      const player = recipients[i];
      try {
        // Only BCC on the first email when sending to multiple recipients
        const includeBcc = (i === 0 && recipients.length > 1);
        await sendEmail(player.email, subject, html, null, null, includeBcc);
        sent++;
      } catch (err) {
        failed.push({ email: player.email, error: err.message });
      }
    }

    if (!singleEmail) {
      await pool.query(
        'UPDATE tournament_results_email SET sent_at = NOW() WHERE tournament_id = ?',
        [tournamentId]
      );
    }

    res.json({ sent, failed, total: recipients.length });
  } catch (err) {
    console.error('Error sending results email:', err);
    res.status(500).json({ error: 'Failed to send results email' });
  }
});

// POST /api/tournaments/:id/restore-backup/:backupId - Restore tournament state from backup
router.post('/:id/restore-backup/:backupId', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const tournamentId = Number(req.params.id);
    const backupId = Number(req.params.backupId);

    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      return res.status(400).json({ error: 'Invalid tournament id' });
    }

    if (!Number.isInteger(backupId) || backupId <= 0) {
      return res.status(400).json({ error: 'Invalid backup id' });
    }

    const [backupRows] = await connection.query(
      `SELECT id, backup_data
       FROM tournament_completion_backups
       WHERE id = ? AND tournament_id = ?
       LIMIT 1`,
      [backupId, tournamentId]
    );

    if (backupRows.length === 0) {
      return res.status(404).json({ error: 'Backup not found for this tournament' });
    }

    const backupData = typeof backupRows[0].backup_data === 'string'
      ? JSON.parse(backupRows[0].backup_data)
      : backupRows[0].backup_data;

    const players = Array.isArray(backupData.players) ? backupData.players : [];
    const quotaRows = Array.isArray(backupData.quota) ? backupData.quota : [];
    const skinsQuotaRows = Array.isArray(backupData.skins_quota) ? backupData.skins_quota : [];
    const tournamentPlayers = Array.isArray(backupData.tournament_players) ? backupData.tournament_players : [];
    const skinWinners = Array.isArray(backupData.tournament_skin_winners) ? backupData.tournament_skin_winners : [];
    const ctpWinners = Array.isArray(backupData.tournament_ctp_winners) ? backupData.tournament_ctp_winners : [];
    const paradisePoints = Array.isArray(backupData.tournament_paradise_points) ? backupData.tournament_paradise_points : [];

    const playerIds = players.map((row) => Number(row.id)).filter((id) => Number.isInteger(id));

    await connection.beginTransaction();

    for (const player of players) {
      await connection.query(
        `UPDATE players
         SET quota_18 = ?, quota_9 = ?, fedex_points = ?, tournaments_played = ?, prize_money = ?
         WHERE id = ?`,
        [
          player.quota_18 ?? null,
          player.quota_9 ?? null,
          player.fedex_points ?? 0,
          player.tournaments_played ?? 0,
          player.prize_money ?? 0,
          player.id
        ]
      );
    }

    if (playerIds.length > 0) {
      const placeholders = playerIds.map(() => '?').join(', ');
      await connection.query(`DELETE FROM quota WHERE player_id IN (${placeholders})`, playerIds);
      await connection.query(`DELETE FROM skins_quota WHERE player_id IN (${placeholders})`, playerIds);
    }

    await insertRows(connection, 'quota', quotaRows);
    await insertRows(connection, 'skins_quota', skinsQuotaRows);

    await connection.query('DELETE FROM tournament_players WHERE tournament_id = ?', [tournamentId]);
    await connection.query('DELETE FROM tournament_skin_winners WHERE tournament_id = ?', [tournamentId]);
    await connection.query('DELETE FROM tournament_ctp_winners WHERE tournament_id = ?', [tournamentId]);
    await connection.query('DELETE FROM tournament_paradise_points WHERE tournament_id = ?', [tournamentId]);

    await insertRows(connection, 'tournament_players', tournamentPlayers);
    await insertRows(connection, 'tournament_skin_winners', skinWinners);
    await insertRows(connection, 'tournament_ctp_winners', ctpWinners);
    await insertRows(connection, 'tournament_paradise_points', paradisePoints);

    await connection.query(
      `UPDATE tournament_completion_backups
       SET restored_at = NOW()
       WHERE id = ?`,
      [backupId]
    );

    await connection.commit();

    console.log(`Tournament backup restored: tournamentId=${tournamentId}, backupId=${backupId}`);

    res.json({
      message: 'Tournament state restored from backup',
      backupId,
      tournamentId
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error restoring tournament backup:', err);
    res.status(500).json({ error: 'Failed to restore tournament backup' });
  } finally {
    connection.release();
  }
});

// POST /api/tournaments/:id/invite-sms - Send SMS invite to all active players
router.post('/:id/invite-sms', async (req, res) => {
  const tournamentId = req.params.id;
  try {
    // Get tournament info
    const [tournamentRows] = await pool.query('SELECT id, date FROM tournament WHERE id = ?', [tournamentId]);
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get all active players with sms_allowed and phone
    const [players] = await pool.query('SELECT id, name, phone FROM players WHERE active = 1 AND sms_allowed = 1 AND phone IS NOT NULL AND phone != ""');
    if (players.length === 0) {
      return res.status(400).json({ error: 'No active players with SMS allowed and phone numbers' });
    }
    
    // Send SMS to each player
    let sent = 0, failed = [];
    for (const player of players) {
      // Generate unique link for each player
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const joinUrl = `${baseUrl}/api/tournaments/join?playerId=${player.id}&tournamentId=${tournamentId}`;
      const msg = `Hi ${player.name}, are you playing in the next tournament? Tap to join: ${joinUrl}`;
      try {
        await sendSMS(player.phone, msg);
        sent++;
      } catch (err) {
        failed.push({ id: player.id, phone: player.phone, error: err.message });
      }
    }
    res.json({ sent, failed });
  } catch (err) {
    console.error('Error sending SMS invites:', err);
    res.status(500).json({ error: 'Failed to send SMS invites' });
  }
});

// POST /api/tournaments/:id/send-sms - Send custom SMS announcement to all active players
router.post('/:id/send-sms', async (req, res) => {
  const tournamentId = req.params.id;
  try {
    // Get tournament info with course details
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Get all active players with sms_allowed and phone
    const [players] = await pool.query(
      'SELECT id, name, phone FROM players WHERE active = 1 AND sms_allowed = 1 AND phone IS NOT NULL AND phone != ""'
    );
    if (players.length === 0) {
      return res.status(400).json({ error: 'No active players with SMS allowed and phone numbers' });
    }
    
    // Get base URL for RSVP links
    const baseUrl = process.env.APP_BASE_URL || 'http://192.168.4.111:3000';
    
    // Send SMS to each player with personalized RSVP link
    let sent = 0, failed = [];
    
    for (const player of players) {
      try {
        const rsvpLink = `${baseUrl}/api/tournaments/${tournamentId}/rsvp?playerId=${player.id}`;
        const message = `If you are playing ${tournament.course_name} ${tournamentDate} click this link ${rsvpLink}`;
        console.log(`Sending SMS to ${player.name} (${player.phone}): ${message}`);
        await sendSMS(player.phone, message);
        console.log(`✓ SMS sent successfully to ${player.name}`);
        sent++;
      } catch (err) {
        console.error(`✗ Failed to send SMS to ${player.name} (${player.phone}): ${err.message}`);
        failed.push({ id: player.id, phone: player.phone, error: err.message });
      }
    }
    
    const sampleMessage = `If you are playing ${tournament.course_name} ${tournamentDate} click this link ${baseUrl}/api/tournaments/${tournamentId}/rsvp?playerId={playerId}`;
    res.json({ sent, failed, message: sampleMessage });
  } catch (err) {
    console.error('Error sending SMS announcement:', err);
    res.status(500).json({ error: 'Failed to send SMS announcement' });
  }
});

// POST /api/tournaments/:id/send-invitations - Send tournament invitations via SMS and/or Email
// Optional body fields: `playerId` limits sending to one player, `customMessage` adds custom text
router.post('/:id/send-invitations', requireAdmin, async (req, res) => {
  const tournamentId = req.params.id;
  const { method, playerId, customMessage } = req.body; // method: 'sms' | 'email' | 'both', optional playerId, customMessage
  
  try {
    // Get tournament info with course details
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Get base URL for RSVP links
    const baseUrl = process.env.APP_BASE_URL || 'http://192.168.4.111:3000';
    
    // Query players based on method (and optional single-player filter)
    let playersQuery = 'SELECT id, name, phone, email FROM players WHERE active = 1';
    const playersParams = [];

    if (method === 'sms' || !method) {
      playersQuery += ' AND sms_allowed = 1 AND phone IS NOT NULL AND phone != ""';
    } else if (method === 'email') {
      playersQuery += ' AND email_allowed = 1 AND email IS NOT NULL AND email != ""';
    } else if (method === 'both') {
      playersQuery += ' AND ((sms_allowed = 1 AND phone IS NOT NULL AND phone != "") OR (email_allowed = 1 AND email IS NOT NULL AND email != ""))';
    } else {
      return res.status(400).json({ error: 'Invalid method. Use "sms", "email", or "both"' });
    }

    if (playerId !== undefined && playerId !== null && playerId !== '') {
      const parsedPlayerId = Number(playerId);
      if (!Number.isInteger(parsedPlayerId) || parsedPlayerId <= 0) {
        return res.status(400).json({ error: 'Invalid playerId' });
      }

      playersQuery += ' AND id = ?';
      playersParams.push(parsedPlayerId);
    }
    
    const [players] = await pool.query(playersQuery, playersParams);
    if (players.length === 0) {
      return res.status(400).json({ error: 'No active players found with the selected contact method' });
    }
    
    let smsSent = 0, emailSent = 0, smsFailed = [], emailFailed = [];
    
    // Count email recipients for BCC logic
    const emailPlayers = players.filter(p => (method === 'email' || method === 'both') && p.email);
    
    for (const player of players) {
      const yesUrl = `${baseUrl}/api/tournaments/${tournamentId}/confirm?playerId=${player.id}&response=yes`;
      const noUrl = `${baseUrl}/api/tournaments/${tournamentId}/confirm?playerId=${player.id}&response=no`;
      
      // Send SMS if applicable
      if ((method === 'sms' || method === 'both') && player.phone) {
        try {
          let smsMessage = `Hi ${player.name}! Are you playing ${tournament.course_name} on ${tournamentDate}?`;
          if (customMessage) {
            smsMessage += `\n\n${customMessage}`;
          }
          smsMessage += `\n\nYes: ${yesUrl}\nNo: ${noUrl}`;
          console.log(`Sending SMS to ${player.name} (${player.phone})`);
          await sendSMS(player.phone, smsMessage);
          console.log(`✓ SMS sent successfully to ${player.name}`);
          smsSent++;
        } catch (err) {
          console.error(`✗ Failed to send SMS to ${player.name}: ${err.message}`);
          smsFailed.push({ id: player.id, name: player.name, phone: player.phone, error: err.message });
        }
      }
      
      // Send Email if applicable
      if ((method === 'email' || method === 'both') && player.email) {
        try {
          const subject = `Tournament Invitation - ${tournament.course_name}`;
          const html = `
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                  .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                  .button { display: inline-block; padding: 12px 30px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                  .btn-yes { background-color: #4CAF50; color: white; }
                  .btn-no { background-color: #f44336; color: white; }
                  .details { background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #4CAF50; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🏌️ Tournament Invitation</h1>
                  </div>
                  <div class="content">
                    <p>Hi ${player.name},</p>
                    <p>We're organizing a tournament and would like to know if you'll be joining us!</p>
                    ${customMessage ? `
                    <div style="background-color: #fffbeb; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; color: #92400e;">
                      <p style="margin: 0; white-space: pre-wrap;">${customMessage}</p>
                    </div>` : ''}
                    <div class="details">
                      <strong>📍 Course:</strong> ${tournament.course_name}<br>
                      <strong>📅 Date:</strong> ${tournamentDate}<br>
                      ${tournament.course_address ? `<strong>🗺️ Location:</strong> ${tournament.course_address}<br>` : ''}
                    </div>
                    
                    <p><strong>Will you be playing?</strong></p>
                    <p style="text-align: center;">
                      <a href="${yesUrl}" class="button btn-yes">✓ Yes, I'll Play</a>
                      <a href="${noUrl}" class="button btn-no">✗ Can't Make It</a>
                    </p>
                    
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                      Looking forward to seeing you on the course!
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `;
          
          console.log(`Sending Email to ${player.name} (${player.email})`);
          // Only BCC on the first email when sending to multiple recipients
          const includeBcc = (emailSent === 0 && emailPlayers.length > 1);
          await sendEmail(player.email, subject, html, null, null, includeBcc);
          console.log(`✓ Email sent successfully to ${player.name}`);
          emailSent++;
        } catch (err) {
          console.error(`✗ Failed to send Email to ${player.name}: ${err.message}`);
          emailFailed.push({ id: player.id, name: player.name, email: player.email, error: err.message });
        }
      }
    }
    
    res.json({ 
      sms: { sent: smsSent, failed: smsFailed },
      email: { sent: emailSent, failed: emailFailed },
      total: players.length
    });
  } catch (err) {
    console.error('Error sending tournament invitations:', err);
    res.status(500).json({ error: 'Failed to send tournament invitations' });
  }
});

// GET /api/tournaments/:id/confirm - Confirm attendance (yes/no) via link
router.get('/:id/confirm', async (req, res) => {
  const tournamentId = req.params.id;
  const { playerId, response } = req.query;
  
  console.log(`Confirmation request received: tournamentId=${tournamentId}, playerId=${playerId}, response=${response}`);
  
  try {
    if (!playerId || !response) {
      console.log('Error: Missing playerId or response');
      return res.status(400).send('<h1>Error: Missing information</h1>');
    }
    
    if (response !== 'yes' && response !== 'no') {
      console.log('Error: Invalid response value');
      return res.status(400).send('<h1>Error: Invalid response</h1>');
    }
    
    // Verify tournament exists
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).send('<h1>Tournament not found</h1>');
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Verify player exists
    const [playerRows] = await pool.query('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (playerRows.length === 0) {
      return res.status(404).send('<h1>Player not found</h1>');
    }
    const player = playerRows[0];
    
    // Check if player is already registered
    const [exists] = await pool.query(
      'SELECT * FROM tournament_players WHERE player_id = ? AND tournament_id = ?',
      [playerId, tournamentId]
    );
    
    if (response === 'yes') {
      // Add player to tournament if not already registered
      if (exists.length === 0) {
        await pool.query(
          'INSERT INTO tournament_players (player_id, tournament_id, attending_status, response_date) VALUES (?, ?, ?, NOW())',
          [playerId, tournamentId, 'yes']
        );
        await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
        console.log(`Inserted new tournament_players record: player ${playerId} ATTENDING tournament ${tournamentId}`);
      } else {
        // Update attending status
        await pool.query(
          'UPDATE tournament_players SET attending_status = ?, response_date = NOW() WHERE player_id = ? AND tournament_id = ?',
          ['yes', playerId, tournamentId]
        );
        await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
        console.log(`Updated tournament_players: player ${playerId} ATTENDING tournament ${tournamentId}`);
      }
      
      // Send success response
      res.send(`
        <html>
          <head>
            <title>Confirmed - See You There!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0f8f0;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #4CAF50;">✓ You're In!</h1>
              <p style="font-size: 18px;">Thanks <strong>${player.name}</strong>!</p>
              <p style="font-size: 16px;">You're registered for:</p>
              <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="margin: 5px 0;"><strong>${tournament.course_name}</strong></p>
                <p style="margin: 5px 0;">${tournamentDate}</p>
              </div>
              <p style="margin-top: 30px; color: #666;">See you on the course! 🏌️</p>
            </div>
          </body>
        </html>
      `);
    } else {
      // response === 'no'
      if (exists.length === 0) {
        // Add record with 'no' status
        await pool.query(
          'INSERT INTO tournament_players (player_id, tournament_id, attending_status, response_date) VALUES (?, ?, ?, NOW())',
          [playerId, tournamentId, 'no']
        );
        await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
        console.log(`Inserted new tournament_players record: player ${playerId} NOT ATTENDING tournament ${tournamentId}`);
      } else {
        // Update status to 'no'
        await pool.query(
          'UPDATE tournament_players SET attending_status = ?, response_date = NOW() WHERE player_id = ? AND tournament_id = ?',
          ['no', playerId, tournamentId]
        );
        await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
        console.log(`Updated tournament_players: player ${playerId} NOT ATTENDING tournament ${tournamentId}`);
      }
      
      // Send acknowledgment response
      res.send(`
        <html>
          <head>
            <title>Response Recorded</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #fff5f5;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #666;">Thanks for Letting Us Know</h1>
              <p style="font-size: 18px;">Hi <strong>${player.name}</strong>,</p>
              <p style="font-size: 16px;">We've recorded that you won't be able to make it to:</p>
              <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #999;">
                <p style="margin: 5px 0;"><strong>${tournament.course_name}</strong></p>
                <p style="margin: 5px 0;">${tournamentDate}</p>
              </div>
              <p style="margin-top: 30px; color: #666;">Hope to see you at the next one!</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('Error processing confirmation:', err);
    res.status(500).send('<h1>Error processing your response. Please contact the administrator.</h1>');
  }
});

// GET /api/tournaments/:id/rsvp - RSVP to a tournament via SMS link
router.get('/:id/rsvp', async (req, res) => {
  const tournamentId = req.params.id;
  const { playerId } = req.query;
  
  try {
    if (!playerId) {
      return res.status(400).send('<h1>Error: Missing player information</h1>');
    }
    
    // Verify tournament exists
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).send('<h1>Tournament not found</h1>');
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Verify player exists
    const [playerRows] = await pool.query('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (playerRows.length === 0) {
      return res.status(404).send('<h1>Player not found</h1>');
    }
    const player = playerRows[0];
    
    // Check if already registered
    const [exists] = await pool.query(
      'SELECT * FROM tournament_players WHERE player_id = ? AND tournament_id = ?',
      [playerId, tournamentId]
    );
    
    if (exists.length > 0) {
      // Update attending status if already exists
      await pool.query(
        'UPDATE tournament_players SET attending_status = ?, response_date = NOW() WHERE player_id = ? AND tournament_id = ?',
        ['yes', playerId, tournamentId]
      );
      await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
      
      return res.send(`
        <html>
          <head><title>Already Registered</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>✓ Already Registered</h1>
            <p><strong>${player.name}</strong>, you're already registered for:</p>
            <p><strong>${tournament.course_name}</strong></p>
            <p>${tournamentDate}</p>
            <p style="margin-top: 30px; color: #666;">See you on the course!</p>
          </body>
        </html>
      `);
    }
    
    // Add player to tournament
    await pool.query(
      'INSERT INTO tournament_players (player_id, tournament_id, paid, attending_status, response_date) VALUES (?, ?, 0, ?, NOW())',
      [playerId, tournamentId, 'yes']
    );
    await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
    
    // Send success response
    res.send(`
      <html>
        <head><title>Registration Confirmed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>✓ Registration Confirmed!</h1>
          <p>Thanks <strong>${player.name}</strong>!</p>
          <p>You're registered for:</p>
          <p><strong>${tournament.course_name}</strong></p>
          <p>${tournamentDate}</p>
          <p style="margin-top: 30px; color: #666;">See you on the course!</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error processing RSVP:', err);
    res.status(500).send('<h1>Error processing your registration. Please contact the administrator.</h1>');
  }
});

// GET /api/tournaments/:id/attendance - Get attendance statistics for a tournament
router.get('/:id/attendance', async (req, res) => {
  const tournamentId = req.params.id;
  
  try {
    // Get tournament info
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get attendance summary
    const [summary] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN attending_status = 'yes' THEN 1 ELSE 0 END) as confirmed_yes,
        SUM(CASE WHEN attending_status = 'no' THEN 1 ELSE 0 END) as confirmed_no,
        SUM(CASE WHEN attending_status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM tournament_players
       WHERE tournament_id = ?`,
      [tournamentId]
    );
    
    // Get player details grouped by response
    const [playersYes] = await pool.query(
      `SELECT p.id, p.name, p.email, p.phone, tp.response_date
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.attending_status = 'yes'
       ORDER BY tp.response_date DESC`,
      [tournamentId]
    );
    
    const [playersNo] = await pool.query(
      `SELECT p.id, p.name, p.email, p.phone, tp.response_date
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.attending_status = 'no'
       ORDER BY tp.response_date DESC`,
      [tournamentId]
    );
    
    const [playersPending] = await pool.query(
      `SELECT p.id, p.name, p.email, p.phone
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.attending_status = 'pending'
       ORDER BY p.name ASC`,
      [tournamentId]
    );
    
    res.json({
      tournament: tournamentRows[0],
      summary: summary[0],
      players: {
        confirmed_yes: playersYes,
        confirmed_no: playersNo,
        pending: playersPending
      }
    });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// GET /api/tournaments/join - Add player to tournament via link
router.get('/join', async (req, res) => {
  const { playerId, tournamentId } = req.query;
  try {
    if (!playerId || !tournamentId) {
      return res.status(400).json({ error: 'Missing playerId or tournamentId' });
    }
    
    // Check if already joined
    const [exists] = await pool.query('SELECT * FROM tournament_players WHERE player_id = ? AND tournament_id = ?', [playerId, tournamentId]);
    if (exists.length > 0) {
      return res.json({ message: 'Already joined' });
    }
    
    // Add to tournament_players
    await pool.query('INSERT INTO tournament_players (player_id, tournament_id) VALUES (?, ?)', [playerId, tournamentId]);
    await saveTournamentQuotaSnapshot(pool, tournamentId, playerId);
    res.json({ message: 'Joined tournament successfully' });
  } catch (err) {
    console.error('Error joining tournament:', err);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

module.exports = router;
