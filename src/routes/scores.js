const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/admin');
const { isAdminCapableRole, isSuperAdminRole } = require('../middleware/admin');
const jwt = require('jsonwebtoken');

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
             h.mens_par, h.ladies_par
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
              h.hole_number, h.mens_par, h.ladies_par
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
        const { tournament_id, player_id, hole_id, score: scoreValue, quota, ctp_feet, ctp_inches, ctp_image_url } = score;
        // Accept either `foursome` (new name) or `foursome_group` (legacy) in incoming payloads
        const foursomeVal = score.foursome || score.foursome_group || null;
        
        // First, always save the score and quota (without CTP data initially)
        const [result] = await connection.query(
           `INSERT INTO scores (tournament_id, player_id, hole_id, score, quota, foursome_group) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             score = VALUES(score), 
             quota = VALUES(quota), 
             foursome_group = VALUES(foursome_group),
             entered_at = CURRENT_TIMESTAMP`,
          [tournament_id, player_id, hole_id, scoreValue, quota, foursomeVal]
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

// GET /api/scores/tournament/:tournamentId/ctp-winners - Get CTP winners
router.get('/tournament/:tournamentId/ctp-winners', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const [savedRows] = await pool.query(
      `SELECT w.ctp_feet, w.ctp_inches, w.ctp_image_url,
              p.id as player_id, p.name as player_name,
              w.hole_number, h.mens_par,
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
              h.hole_number, h.mens_par
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN hole h ON s.hole_id = h.id
       WHERE s.tournament_id = ? 
         AND h.mens_par = 3
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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  let userId;
  try {
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
    userId = decoded.sub;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { tournamentId, group } = req.params;
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
    res.json({ posted: true, ...rows[0] });
  } catch (err) {
    console.error('Error posting foursome scores:', err);
    res.status(500).json({ error: 'Failed to post scores' });
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

