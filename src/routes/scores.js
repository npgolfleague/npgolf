const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/admin');
const { isAdminCapableRole, isSuperAdminRole } = require('../middleware/admin');
const jwt = require('jsonwebtoken');

async function getPar3HolesForCourse(courseId) {
  try {
    const [holeRows] = await pool.query(
      `SELECT h.id AS hole_id, h.hole_number, 3 AS mens_par
       FROM hole h
       WHERE h.course_id = ?
         AND EXISTS (
           SELECT 1
           FROM hole_tee ht
           WHERE ht.hole_id = h.id
             AND ht.par = 3
         )
       ORDER BY h.hole_number ASC`,
      [courseId]
    );

    return holeRows;
  } catch (err) {
    // Backward compatibility for databases that still use hole.mens_par.
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR')) {
      const [legacyHoleRows] = await pool.query(
        `SELECT h.id AS hole_id, h.hole_number, h.mens_par
         FROM hole h
         WHERE h.course_id = ? AND h.mens_par = 3
         ORDER BY h.hole_number ASC`,
        [courseId]
      );

      return legacyHoleRows;
    }

    throw err;
  }
}

// GET /api/scores - List all scores
router.get('/', async (req, res) => {
  try {
    const { tournament_id, player_id } = req.query;
    let query = `
      SELECT s.*, 
             p.name as player_name,
             t.date as tournament_date,
             c.name as course_name,
             h.hole_number,
             (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS mens_par,
             (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS ladies_par
      FROM scores s
      JOIN players p ON s.player_id = p.id
      JOIN tournament t ON s.tournament_id = t.id
      JOIN course c ON t.course_id = c.id
      JOIN hole h ON s.hole_id = h.id
      WHERE 1=1
    `;
    const params = [];
    
    if (tournament_id) {
      query += ' AND s.tournament_id = ?';
      params.push(tournament_id);
    }
    if (player_id) {
      query += ' AND s.player_id = ?';
      params.push(player_id);
    }
    
    query += ' ORDER BY h.hole_number, p.name';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// GET /api/scores/tournament/:tournamentId/groups - Get all foursome groups for a tournament
router.get('/tournament/:tournamentId/groups', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const [rows] = await pool.query(
      `SELECT DISTINCT s.foursome_group,
              GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ', ') as players
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ? AND s.foursome_group IS NOT NULL
       GROUP BY s.foursome_group
       ORDER BY s.foursome_group`,
      [tournamentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching foursome groups:', err);
    res.status(500).json({ error: 'Failed to fetch foursome groups' });
  }
});

// GET /api/scores/tournament/:tournamentId/foursome/:group - Get scores for a specific foursome
router.get('/tournament/:tournamentId/foursome/:group', async (req, res) => {
  try {
    const { tournamentId, group } = req.params;
    const [rows] = await pool.query(
      `SELECT s.*, 
              p.name as player_name, p.sex,
              h.hole_number,
              (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS mens_par,
              (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS ladies_par
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN hole h ON s.hole_id = h.id
       WHERE s.tournament_id = ? AND s.foursome_group = ?
       ORDER BY h.hole_number, p.name`,
      [tournamentId, group]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching foursome scores:', err);
    res.status(500).json({ error: 'Failed to fetch foursome scores' });
  }
});

// POST /api/scores - Create score(s)
router.post('/', async (req, res) => {
  try {
    const { scores } = req.body; // Array of score objects
    
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'Scores array is required' });
    }

    // Check if the foursome is posted/locked — if so, require admin
    const firstScore = scores[0];
    const foursomeVal = firstScore.foursome || firstScore.foursome_group || null;
    if (foursomeVal && firstScore.tournament_id) {
      const [postRows] = await pool.query(
        'SELECT id FROM foursome_posts WHERE tournament_id = ? AND foursome_group = ? LIMIT 1',
        [firstScore.tournament_id, foursomeVal]
      );
      if (postRows.length > 0) {
        // Scores are locked — verify admin JWT
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(403).json({ error: 'Scores have been posted. Admin access required to modify.' });
        }
        try {
          const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
          const [userRows] = await pool.query('SELECT id, role FROM players WHERE id = ? LIMIT 1', [decoded.sub]);
          const user = userRows[0];
          if (!user || !isAdminCapableRole(user.role)) {
            return res.status(403).json({ error: 'Scores have been posted. Admin access required to modify.' });
          }

          if (!isSuperAdminRole(user.role)) {
            if (!req.league?.id) {
              return res.status(403).json({ error: 'Scores have been posted. League admin access requires league context.' });
            }

            const [leagueMembership] = await pool.query(
              'SELECT 1 FROM league_players WHERE league_id = ? AND player_id = ? LIMIT 1',
              [req.league.id, user.id]
            );

            if (!leagueMembership.length) {
              return res.status(403).json({ error: 'Scores have been posted. League admin is not a member of this league.' });
            }
          }
        } catch {
          return res.status(403).json({ error: 'Scores have been posted. Admin access required to modify.' });
        }
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const score of scores) {
        const {
          tournament_id,
          player_id,
          hole_id,
          score: scoreValue,
          quota,
          ctp_feet,
          ctp_inches,
          ctp_image_url,
          foursome_ctp_feet,
          foursome_ctp_inches,
          foursome_ctp_image_url
        } = score;
        // Accept either `foursome` (new name) or `foursome_group` (legacy) in incoming payloads
        const foursomeVal = score.foursome || score.foursome_group || null;
        
        // First, always save the score and quota (without CTP data initially)
        const [result] = await connection.query(
           `INSERT INTO scores (tournament_id, player_id, hole_id, score, quota, foursome_group, ctp_feet, ctp_inches, ctp_image_url, foursome_ctp_feet, foursome_ctp_inches, foursome_ctp_image_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             score = VALUES(score), 
             quota = VALUES(quota), 
             foursome_group = VALUES(foursome_group),
             ctp_feet = VALUES(ctp_feet),
             ctp_inches = VALUES(ctp_inches),
             ctp_image_url = VALUES(ctp_image_url),
             foursome_ctp_feet = VALUES(foursome_ctp_feet),
             foursome_ctp_inches = VALUES(foursome_ctp_inches),
             foursome_ctp_image_url = VALUES(foursome_ctp_image_url),
             entered_at = CURRENT_TIMESTAMP`,
          [
            tournament_id,
            player_id,
            hole_id,
            scoreValue,
            quota,
            foursomeVal,
            ctp_feet,
            ctp_inches,
            ctp_image_url,
            foursome_ctp_feet,
            foursome_ctp_inches,
            foursome_ctp_image_url
          ]
        );
        
        // Now handle CTP data separately if provided
        if (ctp_feet !== null && ctp_feet !== undefined) {
          const newDistance = (parseInt(ctp_feet) * 12) + parseFloat(ctp_inches || 0);
          console.log(`New CTP submission: Player ${player_id}, Hole ${hole_id}, Distance: ${ctp_feet}' ${ctp_inches}" (${newDistance} inches)`);
          
          // Get all CTPs for this hole in this tournament (excluding this player)
          const [existingCtps] = await connection.query(
            `SELECT s.player_id, s.ctp_feet, s.ctp_inches, p.name
             FROM scores s 
             JOIN players p ON s.player_id = p.id
             WHERE s.tournament_id = ? AND s.hole_id = ? AND s.player_id != ? AND s.ctp_feet IS NOT NULL`,
            [tournament_id, hole_id, player_id]
          );
          
          console.log(`Found ${existingCtps.length} existing CTP(s) for this hole`);
          
          // Check if there's a closer CTP
          let hasCloser = false;
          for (const existingCtp of existingCtps) {
            const existingDistance = (parseInt(existingCtp.ctp_feet) * 12) + parseFloat(existingCtp.ctp_inches || 0);
            console.log(`Comparing with ${existingCtp.name}: ${existingCtp.ctp_feet}' ${existingCtp.ctp_inches}" (${existingDistance} inches)`);
            if (existingDistance <= newDistance) {
              console.log(`Existing CTP is closer or equal. Rejecting new CTP.`);
              hasCloser = true;
              break;
            }
          }
          
          // Only update CTP if this is the closest
          if (!hasCloser) {
            console.log(`New CTP is closest! Saving and clearing other CTPs.`);
            // This is the closest - save this CTP and clear others
            await connection.query(
              `UPDATE scores 
               SET ctp_feet = ?, ctp_inches = ?, ctp_image_url = ?
               WHERE tournament_id = ? AND hole_id = ? AND player_id = ?`,
              [ctp_feet, ctp_inches, ctp_image_url, tournament_id, hole_id, player_id]
            );
            
            // Clear CTP data from other players for this hole
            await connection.query(
              `UPDATE scores 
               SET ctp_feet = NULL, ctp_inches = NULL, ctp_image_url = NULL 
               WHERE tournament_id = ? AND hole_id = ? AND player_id != ?`,
              [tournament_id, hole_id, player_id]
            );
          } else {
            console.log(`Not saving CTP as it's not the closest.`);
          }
        }

        if (foursome_ctp_feet !== null && foursome_ctp_feet !== undefined) {
          const newDistance = (parseInt(foursome_ctp_feet) * 12) + parseFloat(foursome_ctp_inches || 0);
          console.log(`New side-game CTP submission: Player ${player_id}, Hole ${hole_id}, Distance: ${foursome_ctp_feet}' ${foursome_ctp_inches}" (${newDistance} inches)`);

          const [existingFoursomeCtps] = await connection.query(
            `SELECT s.player_id, s.foursome_ctp_feet, s.foursome_ctp_inches, p.name
             FROM scores s 
             JOIN players p ON s.player_id = p.id
             WHERE s.tournament_id = ? AND s.hole_id = ? AND s.player_id != ? AND s.foursome_ctp_feet IS NOT NULL`,
            [tournament_id, hole_id, player_id]
          );

          console.log(`Found ${existingFoursomeCtps.length} existing side-game CTP(s) for this hole`);

          let hasCloser = false;
          for (const existingCtp of existingFoursomeCtps) {
            const existingDistance = (parseInt(existingCtp.foursome_ctp_feet) * 12) + parseFloat(existingCtp.foursome_ctp_inches || 0);
            console.log(`Comparing side-game CTP with ${existingCtp.name}: ${existingCtp.foursome_ctp_feet}' ${existingCtp.foursome_ctp_inches}" (${existingDistance} inches)`);
            if (existingDistance <= newDistance) {
              console.log(`Existing side-game CTP is closer or equal. Rejecting new CTP.`);
              hasCloser = true;
              break;
            }
          }

          if (!hasCloser) {
            console.log(`New side-game CTP is closest! Saving and clearing other side-game CTPs.`);
            await connection.query(
              `UPDATE scores 
               SET foursome_ctp_feet = ?, foursome_ctp_inches = ?, foursome_ctp_image_url = ?
               WHERE tournament_id = ? AND hole_id = ? AND player_id = ?`,
              [foursome_ctp_feet, foursome_ctp_inches, foursome_ctp_image_url, tournament_id, hole_id, player_id]
            );

            await connection.query(
              `UPDATE scores 
               SET foursome_ctp_feet = NULL, foursome_ctp_inches = NULL, foursome_ctp_image_url = NULL 
               WHERE tournament_id = ? AND hole_id = ? AND player_id != ?`,
              [tournament_id, hole_id, player_id]
            );
          } else {
            console.log(`Not saving side-game CTP as it's not the closest.`);
          }
        }
        
        results.push({ id: result.insertId, ...score, foursome: foursomeVal });
      }
      
      await connection.commit();
      res.status(201).json({ message: 'Scores saved successfully', scores: results });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error creating scores:', err);
    res.status(500).json({ error: 'Failed to create scores' });
  }
});

// PUT /api/scores/:id - Update score
router.put('/:id', async (req, res) => {
  try {
    const { score, quota } = req.body;
    // Accept either name for foursome field
    const foursomeVal = req.body.foursome || req.body.foursome_group || null;
    await pool.query(
      'UPDATE scores SET score = ?, quota = ?, foursome_group = ?, entered_at = CURRENT_TIMESTAMP WHERE id = ?',
      [score, quota, foursomeVal, req.params.id]
    );
    res.json({ id: req.params.id, score, quota, foursome: foursomeVal });
  } catch (err) {
    console.error('Error updating score:', err);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

// DELETE /api/scores/:id - Delete score
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM scores WHERE id = ?', [req.params.id]);
    res.json({ message: 'Score deleted' });
  } catch (err) {
    console.error('Error deleting score:', err);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

// GET /api/scores/tournament/:tournamentId/hole/:holeId/ctp-leader - Get current CTP leader for a hole
router.get('/tournament/:tournamentId/hole/:holeId/ctp-leader', async (req, res) => {
  try {
    const { tournamentId, holeId } = req.params;
    const [rows] = await pool.query(
      `SELECT s.ctp_feet, s.ctp_inches,
              p.id as player_id, p.name as player_name
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ? AND s.hole_id = ? AND s.ctp_feet IS NOT NULL
       ORDER BY (s.ctp_feet * 12 + s.ctp_inches) ASC
       LIMIT 1`,
      [tournamentId, holeId]
    );
    
    if (rows.length === 0) {
      return res.json(null);
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching CTP leader:', err);
    res.status(500).json({ error: 'Failed to fetch CTP leader' });
  }
});

// GET /api/scores/tournament/:tournamentId/ctp-admin-options - Get par-3 holes, tournament players, and saved CTP winners
router.get('/tournament/:tournamentId/ctp-admin-options', requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const [tournamentRows] = await pool.query(
      'SELECT id, course_id, number_of_holes, nine_hole_side FROM tournament WHERE id = ? LIMIT 1',
      [tournamentId]
    );

    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentRows[0];

    const holeRows = await getPar3HolesForCourse(tournament.course_id);

    let ctpHoles = holeRows;
    if (Number(tournament.number_of_holes) === 9) {
      const useBackNine = tournament.nine_hole_side === 'back';
      ctpHoles = holeRows.filter(h => useBackNine ? h.hole_number > 9 : h.hole_number <= 9);
    }

    const [playerRows] = await pool.query(
      `SELECT DISTINCT p.id, p.name
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       WHERE tp.tournament_id = ?
       ORDER BY p.name ASC`,
      [tournamentId]
    );

    const [winnerRows] = await pool.query(
      `SELECT w.hole_id, w.hole_number, w.player_id, w.ctp_feet, w.ctp_inches,
              p.name AS player_name
       FROM tournament_ctp_winners w
       JOIN players p ON p.id = w.player_id
       WHERE w.tournament_id = ?
       ORDER BY w.hole_number ASC`,
      [tournamentId]
    );

    return res.json({
      holes: ctpHoles,
      players: playerRows,
      winners: winnerRows
    });
  } catch (err) {
    console.error('Error fetching CTP admin options:', err);
    return res.status(500).json({ error: 'Failed to fetch CTP admin options' });
  }
});

// PUT /api/scores/tournament/:tournamentId/ctp-winners - Upsert/remove CTP winners (admin only)
router.put('/tournament/:tournamentId/ctp-winners', requireAdmin, async (req, res) => {
  const { tournamentId } = req.params;
  const { winners } = req.body || {};

  if (!Array.isArray(winners)) {
    return res.status(400).json({ error: 'winners array is required' });
  }

  try {
    const [tournamentRows] = await pool.query(
      'SELECT id, course_id, number_of_holes, nine_hole_side FROM tournament WHERE id = ? LIMIT 1',
      [tournamentId]
    );

    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentRows[0];

    const holeRows = await getPar3HolesForCourse(tournament.course_id);

    let allowedHoles = holeRows;
    if (Number(tournament.number_of_holes) === 9) {
      const useBackNine = tournament.nine_hole_side === 'back';
      allowedHoles = holeRows.filter(h => useBackNine ? h.hole_number > 9 : h.hole_number <= 9);
    }

    const holeByNumber = new Map(allowedHoles.map(h => [Number(h.hole_number), h]));

    const [playerRows] = await pool.query(
      `SELECT DISTINCT tp.player_id
       FROM tournament_players tp
       WHERE tp.tournament_id = ?`,
      [tournamentId]
    );
    const validPlayerIds = new Set(playerRows.map(r => Number(r.player_id)));

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const entry of winners) {
        const holeNumber = Number(entry?.hole_number);
        if (!Number.isInteger(holeNumber)) {
          throw new Error('Each winner entry must include a valid hole_number');
        }

        const hole = holeByNumber.get(holeNumber);
        if (!hole) {
          throw new Error(`Hole ${holeNumber} is not a valid CTP hole for this tournament`);
        }

        const playerId = entry?.player_id == null || entry.player_id === ''
          ? null
          : Number(entry.player_id);

        if (playerId == null) {
          // Empty player means clear winner for this hole
          await connection.query(
            'DELETE FROM tournament_ctp_winners WHERE tournament_id = ? AND hole_id = ?',
            [tournamentId, hole.hole_id]
          );
          continue;
        }

        if (!Number.isInteger(playerId) || !validPlayerIds.has(playerId)) {
          throw new Error(`Player ${entry.player_id} is not a valid player for this tournament`);
        }

        const ctpFeet = entry?.ctp_feet == null || entry.ctp_feet === '' ? null : Number(entry.ctp_feet);
        const ctpInches = entry?.ctp_inches == null || entry.ctp_inches === '' ? null : Number(entry.ctp_inches);

        if (ctpFeet != null && (!Number.isFinite(ctpFeet) || ctpFeet < 0)) {
          throw new Error(`Invalid feet value for hole ${holeNumber}`);
        }
        if (ctpInches != null && (!Number.isFinite(ctpInches) || ctpInches < 0 || ctpInches >= 12)) {
          throw new Error(`Invalid inches value for hole ${holeNumber}`);
        }

        await connection.query(
          `INSERT INTO tournament_ctp_winners
            (tournament_id, hole_id, hole_number, player_id, ctp_feet, ctp_inches, ctp_image_url, prize_money)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 0.00)
           ON DUPLICATE KEY UPDATE
             player_id = VALUES(player_id),
             ctp_feet = VALUES(ctp_feet),
             ctp_inches = VALUES(ctp_inches),
             ctp_image_url = VALUES(ctp_image_url)`,
          [tournamentId, hole.hole_id, holeNumber, playerId, ctpFeet, ctpInches]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const [updatedRows] = await pool.query(
      `SELECT w.ctp_feet, w.ctp_inches, w.ctp_image_url,
              p.id as player_id, p.name as player_name,
              w.hole_number,
              (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS mens_par,
              w.prize_money
       FROM tournament_ctp_winners w
       JOIN players p ON w.player_id = p.id
       LEFT JOIN hole h ON w.hole_id = h.id
       WHERE w.tournament_id = ?
       ORDER BY w.hole_number ASC`,
      [tournamentId]
    );

    return res.json(updatedRows);
  } catch (err) {
    console.error('Error updating CTP winners:', err);
    return res.status(400).json({ error: err.message || 'Failed to update CTP winners' });
  }
});

// GET /api/scores/tournament/:tournamentId/ctp-winners - Get CTP winners
router.get('/tournament/:tournamentId/ctp-winners', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const [savedRows] = await pool.query(
      `SELECT w.ctp_feet, w.ctp_inches, w.ctp_image_url,
              p.id as player_id, p.name as player_name,
              w.hole_number,
              (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS mens_par,
              w.prize_money
       FROM tournament_ctp_winners w
       JOIN players p ON w.player_id = p.id
       LEFT JOIN hole h ON w.hole_id = h.id
       WHERE w.tournament_id = ?
       ORDER BY w.hole_number ASC`,
      [tournamentId]
    );

    if (savedRows.length > 0) {
      return res.json(savedRows);
    }

    const [tournamentRows] = await pool.query(
      'SELECT number_of_holes FROM tournament WHERE id = ? LIMIT 1',
      [tournamentId]
    );

    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentRows[0];

    const [rows] = await pool.query(
      `SELECT s.ctp_feet, s.ctp_inches, s.ctp_image_url,
              p.id as player_id, p.name as player_name,
              h.hole_number,
              (SELECT par FROM hole_tee WHERE hole_id = h.id ORDER BY id LIMIT 1) AS mens_par
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN hole h ON s.hole_id = h.id
       JOIN hole_tee ht_par ON ht_par.hole_id = h.id AND ht_par.par = 3
       WHERE s.tournament_id = ? 
         AND s.ctp_feet IS NOT NULL
       ORDER BY (s.ctp_feet * 12 + s.ctp_inches) ASC, h.hole_number ASC`,
      [tournamentId]
    );
    
    // Group by hole and get the closest for each
    const winners = {};
    rows.forEach(row => {
      if (!winners[row.hole_number] || 
          (row.ctp_feet * 12 + row.ctp_inches) < (winners[row.hole_number].ctp_feet * 12 + winners[row.hole_number].ctp_inches)) {
        winners[row.hole_number] = row;
      }
    });

    let result = Object.values(winners).sort((a, b) => a.hole_number - b.hole_number);

    // For 9-hole tournaments, only return 2 CTP winners
    if (tournament.number_of_holes === 9) {
      result = result.slice(0, 2);
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching CTP winners:', err);
    res.status(500).json({ error: 'Failed to fetch CTP winners' });
  }
});

// GET /api/scores/tournament/:tournamentId/foursome/:group/post-status - Check if foursome is posted
router.get('/tournament/:tournamentId/foursome/:group/post-status', async (req, res) => {
  try {
    const { tournamentId, group } = req.params;
    const [rows] = await pool.query(
      `SELECT fp.id, fp.posted_at, p.name as posted_by_name
       FROM foursome_posts fp
       JOIN players p ON fp.posted_by = p.id
       WHERE fp.tournament_id = ? AND fp.foursome_group = ? LIMIT 1`,
      [tournamentId, group]
    );
    res.json({ posted: rows.length > 0, ...(rows[0] || {}) });
  } catch (err) {
    console.error('Error checking foursome post status:', err);
    res.status(500).json({ error: 'Failed to check post status' });
  }
});

// POST /api/scores/tournament/:tournamentId/foursome/:group/post - Mark foursome scores as posted
router.post('/tournament/:tournamentId/foursome/:group/post', async (req, res) => {
  const requestId = `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { tournamentId, group } = req.params;
  console.log(`[${requestId}] Post foursome request`, {
    tournamentId,
    group,
    hasAuthHeader: Boolean(req.headers.authorization),
    hasLeagueContext: Boolean(req.league?.id)
  });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[${requestId}] Missing or invalid auth header`);
    return res.status(401).json({ error: 'Authentication required', request_id: requestId });
  }

  let userId;
  try {
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
    userId = decoded.sub;
  } catch (err) {
    console.warn(`[${requestId}] Token verification failed:`, err.message);
    return res.status(401).json({ error: 'Invalid token', request_id: requestId });
  }

  try {
    await pool.query(
      `INSERT INTO foursome_posts (tournament_id, foursome_group, posted_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE posted_at = CURRENT_TIMESTAMP, posted_by = VALUES(posted_by)`,
      [tournamentId, group, userId]
    );
    const [rows] = await pool.query(
      `SELECT fp.id, fp.posted_at, p.name as posted_by_name
       FROM foursome_posts fp
       JOIN players p ON fp.posted_by = p.id
       WHERE fp.tournament_id = ? AND fp.foursome_group = ? LIMIT 1`,
      [tournamentId, group]
    );
    console.log(`[${requestId}] Post foursome success`, {
      tournamentId,
      group,
      postedBy: userId
    });
    res.json({ posted: true, ...rows[0] });
  } catch (err) {
    console.error(`[${requestId}] Error posting foursome scores:`, {
      message: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      tournamentId,
      group,
      userId
    });
    res.status(500).json({ error: 'Failed to post scores', request_id: requestId });
  }
});

// GET /api/scores/tournament/:tournamentId/posted-groups - Get all posted foursome groups
router.get('/tournament/:tournamentId/posted-groups', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const [rows] = await pool.query(
      'SELECT foursome_group FROM foursome_posts WHERE tournament_id = ?',
      [tournamentId]
    );
    res.json(rows.map(r => r.foursome_group));
  } catch (err) {
    console.error('Error fetching posted groups:', err);
    res.status(500).json({ error: 'Failed to fetch posted groups' });
  }
});

module.exports = router;

