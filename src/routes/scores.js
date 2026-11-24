const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin, requireAuth, assertLeagueAdmin, AuthError } = require('../middleware/admin');
const { requireOpenSeason, requireOpenSeasonForScores, requireOpenSeasonForScore } = require('../middleware/season');
const { getHoleReveal, isScoreVisibleToPlayer, getUserFoursomes } = require('../utils/holeReveal');

// True when the signed-in user is a league admin (admins see and fix everything).
const isLeagueAdmin = async (req) => {
  try {
    await assertLeagueAdmin(req, req.user);
    return true;
  } catch (err) {
    if (err instanceof AuthError) return false;
    throw err;
  }
};

// Why this player may not save these scores, or null when they may. "Their
// foursome" is the one set in the round's line-up (players can rearrange it).
async function findForeignScore(scores, userId) {
  const tournamentIds = [...new Set(scores.map((s) => Number(s?.tournament_id)))];
  for (const tournamentId of tournamentIds) {
    const [done] = await pool.query(
      'SELECT 1 FROM tournament_paradise_points WHERE tournament_id = ? LIMIT 1',
      [tournamentId]
    );
    if (done.length > 0) return 'This round is completed. Ask an admin to make changes.';

    const [roster] = await pool.query(
      `SELECT player_id, foursome FROM tournament_players
       WHERE tournament_id = ? AND foursome IS NOT NULL AND foursome <> ''`,
      [tournamentId]
    );
    const foursomeOf = new Map(roster.map((r) => [Number(r.player_id), String(r.foursome)]));
    const mine = foursomeOf.get(Number(userId));
    if (!mine) return 'Add yourself to a foursome before entering scores.';

    for (const score of scores.filter((s) => Number(s?.tournament_id) === tournamentId)) {
      const group = score.foursome || score.foursome_group;
      if (foursomeOf.get(Number(score.player_id)) !== mine || String(group ?? '') !== mine) {
        return 'You can only enter scores for your own foursome.';
      }
    }
  }
  return null;
}

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
// Players see their own scores and their own foursome's, plus other players'
// scores only on holes every player has finished (see utils/holeReveal).
router.get('/', requireAuth, async (req, res) => {
  try {
    const { tournament_id, player_id } = req.query;
    const admin = await isLeagueAdmin(req);
    if (!admin && !tournament_id) {
      return res.status(400).json({ error: 'tournament_id is required' });
    }
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
    if (admin) return res.json(rows);

    const reveal = await getHoleReveal(pool, tournament_id);
    const myFoursomes = await getUserFoursomes(pool, tournament_id, req.user.id);
    res.json(rows.filter((row) => isScoreVisibleToPlayer(row, reveal, req.user.id, myFoursomes)));
  } catch (err) {
    console.error('Error fetching scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// GET /api/scores/tournament/:tournamentId/groups - Get all foursome groups for a tournament
// Includes the foursomes assigned in Tournament Players (tournament_players.foursome),
// even before anyone has scored, plus any groups that only exist in scores.
router.get('/tournament/:tournamentId/groups', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const [assignedRows] = await pool.query(
      `SELECT tp.foursome AS foursome_group, tp.player_id, tp.pair, p.name
       FROM tournament_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.foursome IS NOT NULL AND tp.foursome <> ''
         AND (tp.attending_status IS NULL OR tp.attending_status <> 'no')
       ORDER BY tp.pair IS NULL, tp.pair, p.name`,
      [tournamentId]
    );
    const [scoredRows] = await pool.query(
      `SELECT DISTINCT s.foursome_group, s.player_id, p.name
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ? AND s.foursome_group IS NOT NULL AND s.foursome_group <> ''
       ORDER BY p.name`,
      [tournamentId]
    );

    const groups = new Map();
    const getGroup = (name) => {
      if (!groups.has(name)) groups.set(name, { foursome_group: name, assigned: false, members: new Map() });
      return groups.get(name);
    };
    for (const row of assignedRows) {
      const g = getGroup(row.foursome_group);
      g.assigned = true;
      g.members.set(row.player_id, { id: row.player_id, name: row.name, pair: row.pair });
    }
    for (const row of scoredRows) {
      const g = getGroup(row.foursome_group);
      // Assigned groups list their current roster; scored-only groups list who has scores.
      if (!g.assigned && !g.members.has(row.player_id)) {
        g.members.set(row.player_id, { id: row.player_id, name: row.name, pair: null });
      }
    }

    const result = [...groups.values()]
      .map((g) => {
        const members = [...g.members.values()];
        return {
          foursome_group: g.foursome_group,
          assigned: g.assigned,
          players: members.map((m) => m.name).join(', '),
          player_ids: members.map((m) => m.id)
        };
      })
      .sort((a, b) => String(a.foursome_group).localeCompare(String(b.foursome_group), undefined, { numeric: true }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching foursome groups:', err);
    res.status(500).json({ error: 'Failed to fetch foursome groups' });
  }
});

// GET /api/scores/tournament/:tournamentId/foursome/:group - Get scores for a specific foursome
router.get('/tournament/:tournamentId/foursome/:group', requireAuth, async (req, res) => {
  try {
    const { tournamentId, group } = req.params;
    const admin = await isLeagueAdmin(req);
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
    if (admin) return res.json(rows);
    // Another foursome's card only shows holes every player has finished.
    const myFoursomes = await getUserFoursomes(pool, tournamentId, req.user.id);
    if (myFoursomes.has(String(group))) return res.json(rows);
    const reveal = await getHoleReveal(pool, tournamentId);
    res.json(rows.filter((row) => isScoreVisibleToPlayer(row, reveal, req.user.id, myFoursomes)));
  } catch (err) {
    console.error('Error fetching foursome scores:', err);
    res.status(500).json({ error: 'Failed to fetch foursome scores' });
  }
});

// POST /api/scores - Create score(s)
router.post('/', requireAuth, requireOpenSeasonForScores, async (req, res) => {
  try {
    const { scores } = req.body; // Array of score objects
    
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'Scores array is required' });
    }

    // If any foursome in this submission has been posted (locked), only an admin
    // may change it. Check every (tournament, foursome) pair, not just the first.
    const groupKeys = new Map();
    for (const score of scores) {
      const foursomeVal = score?.foursome || score?.foursome_group || null;
      if (foursomeVal && score?.tournament_id) {
        groupKeys.set(`${score.tournament_id}::${foursomeVal}`, [score.tournament_id, foursomeVal]);
      }
    }
    if (groupKeys.size > 0) {
      const pairs = [...groupKeys.values()];
      const [postRows] = await pool.query(
        `SELECT id FROM foursome_posts WHERE ${pairs.map(() => '(tournament_id = ? AND foursome_group = ?)').join(' OR ')} LIMIT 1`,
        pairs.flat()
      );
      if (postRows.length > 0) {
        try {
          await assertLeagueAdmin(req, req.user);
        } catch (authErr) {
          if (authErr instanceof AuthError) {
            return res.status(403).json({ error: 'Scores for this group have been posted. Ask an admin to make changes.' });
          }
          throw authErr;
        }
      }
    }

    // Players enter scores for their own foursome only, and not once the round
    // is completed. Admins can change anything in their league.
    if (!(await isLeagueAdmin(req))) {
      const problem = await findForeignScore(scores, req.user.id);
      if (problem) return res.status(403).json({ error: problem });
    }

    // Saved holes lock: once a player has a score saved on a later hole, a
    // non-admin can't change their score on an earlier one. The hole you're on
    // can still be corrected until the next hole is saved. Re-sending the same
    // score is fine (the app re-saves a hole when you move between holes).
    if (!(await isLeagueAdmin(req))) {
      for (const score of scores) {
        if (score?.score === undefined || score?.score === null) continue;
        const [existingRows] = await pool.query(
          `SELECT s.score, s.entered_at, h.hole_number
           FROM scores s JOIN hole h ON h.id = s.hole_id
           WHERE s.tournament_id = ? AND s.player_id = ? AND s.hole_id = ?`,
          [score.tournament_id, score.player_id, score.hole_id]
        );
        const existing = existingRows[0];
        if (!existing || Number(existing.score) === Number(score.score)) continue;
        const [laterRows] = await pool.query(
          `SELECT 1 FROM scores
           WHERE tournament_id = ? AND player_id = ? AND hole_id <> ? AND entered_at > ?
           LIMIT 1`,
          [score.tournament_id, score.player_id, score.hole_id, existing.entered_at]
        );
        if (laterRows.length > 0) {
          return res.status(409).json({
            error: `Hole ${existing.hole_number} is locked because a later hole has been saved. Ask an admin to correct it.`,
            locked_hole: Number(existing.hole_number)
          });
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
           `INSERT INTO scores (tournament_id, player_id, hole_id, score, quota, foursome_group)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             entered_at = IF(score <=> VALUES(score), entered_at, CURRENT_TIMESTAMP(3)),
             score = VALUES(score),
             quota = VALUES(quota),
             foursome_group = VALUES(foursome_group)`,
          [
            tournament_id,
            player_id,
            hole_id,
            scoreValue,
            quota,
            foursomeVal
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
router.put('/:id', requireAdmin, requireOpenSeasonForScore, async (req, res) => {
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
router.delete('/:id', requireAdmin, requireOpenSeasonForScore, async (req, res) => {
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
router.put('/tournament/:tournamentId/ctp-winners', requireAdmin, requireOpenSeason, async (req, res) => {
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

// ---------------------------------------------------------------------------
// Posting a card, and the marker's sign-off
//
// When the league's "require_card_attest" setting is on, posting submits the
// card and a player from the other pair (the marker) signs it on their own
// phone, or flags a problem for an admin. When it's off, posting is final.
// Any post row locks the card's scores for non-admins (see POST /api/scores).
// ---------------------------------------------------------------------------

const getCardContext = async (tournamentId, group) => {
  const [settingRows] = await pool.query(
    `SELECT COALESCE(ls.require_card_attest, 0) AS require_card_attest
     FROM tournament t
     LEFT JOIN league_settings ls ON ls.league_id = t.league_id
     WHERE t.id = ?`,
    [tournamentId]
  );
  const [memberRows] = await pool.query(
    `SELECT tp.player_id, tp.pair, p.name
     FROM tournament_players tp JOIN players p ON p.id = tp.player_id
     WHERE tp.tournament_id = ? AND tp.foursome = ?
       AND (tp.attending_status IS NULL OR tp.attending_status <> 'no')
     UNION
     SELECT DISTINCT s.player_id, NULL AS pair, p.name
     FROM scores s JOIN players p ON p.id = s.player_id
     WHERE s.tournament_id = ? AND s.foursome_group = ?
       AND s.player_id NOT IN (
         SELECT player_id FROM tournament_players
         WHERE tournament_id = ? AND foursome = ? AND (attending_status IS NULL OR attending_status <> 'no')
       )`,
    [tournamentId, group, tournamentId, group, tournamentId, group]
  );
  const [postRows] = await pool.query(
    `SELECT fp.id, fp.posted_at, fp.posted_by, fp.status, fp.attested_at, fp.dispute_note, fp.disputed_at,
            pb.name AS posted_by_name, ab.name AS attested_by_name, db.name AS disputed_by_name
     FROM foursome_posts fp
     LEFT JOIN players pb ON pb.id = fp.posted_by
     LEFT JOIN players ab ON ab.id = fp.attested_by
     LEFT JOIN players db ON db.id = fp.disputed_by
     WHERE fp.tournament_id = ? AND fp.foursome_group = ? LIMIT 1`,
    [tournamentId, group]
  );
  return {
    requireAttest: Number(settingRows[0]?.require_card_attest) === 1,
    members: memberRows.map((m) => ({ id: Number(m.player_id), name: m.name, pair: m.pair == null ? null : Number(m.pair) })),
    post: postRows[0] || null
  };
};

// The marker is anyone else in the foursome; when pairs are set, it must be
// someone from the other pair than the player who posted.
const getEligibleMarkers = (members, postedBy) => {
  const poster = members.find((m) => m.id === Number(postedBy));
  return members.filter((m) => {
    if (m.id === Number(postedBy)) return false;
    if (poster && poster.pair != null && m.pair != null) return m.pair !== poster.pair;
    return true;
  });
};

const cardStatusPayload = (ctx, userId, admin) => {
  const { post, requireAttest, members } = ctx;
  const markers = post ? getEligibleMarkers(members, post.posted_by) : [];
  const awaitingOrDisputed = post && (post.status === 'awaiting_marker' || post.status === 'disputed');
  return {
    posted: Boolean(post),
    require_attest: requireAttest,
    status: post ? post.status : null,
    posted_at: post?.posted_at || null,
    posted_by_name: post?.posted_by_name || null,
    attested_by_name: post?.attested_by_name || null,
    attested_at: post?.attested_at || null,
    dispute_note: post?.dispute_note || null,
    disputed_by_name: post?.disputed_by_name || null,
    marker_names: markers.map((m) => m.name),
    can_attest: Boolean(
      awaitingOrDisputed &&
      (admin || (post.status === 'awaiting_marker' && markers.some((m) => m.id === Number(userId))))
    ),
    can_reopen: Boolean(post && admin)
  };
};

// GET /api/scores/tournament/:tournamentId/foursome/:group/post-status - Card status for this foursome
router.get('/tournament/:tournamentId/foursome/:group/post-status', requireAuth, async (req, res) => {
  try {
    const { tournamentId, group } = req.params;
    const ctx = await getCardContext(tournamentId, group);
    res.json(cardStatusPayload(ctx, req.user.id, await isLeagueAdmin(req)));
  } catch (err) {
    console.error('Error checking foursome post status:', err);
    res.status(500).json({ error: 'Failed to check post status' });
  }
});

// POST /api/scores/tournament/:tournamentId/foursome/:group/post - Post the card
// (or submit it for the marker to sign, when the league requires that)
router.post('/tournament/:tournamentId/foursome/:group/post', requireAuth, requireOpenSeason, async (req, res) => {
  const { tournamentId, group } = req.params;
  const userId = req.user.id;

  try {
    const ctx = await getCardContext(tournamentId, group);
    if (!(await isLeagueAdmin(req))) {
      if (!ctx.members.some((m) => m.id === Number(userId))) {
        return res.status(403).json({ error: 'Only players in this foursome can post its card.' });
      }
      if (ctx.post) return res.status(409).json({ error: 'This card has already been posted. Ask an admin to make changes.' });
    }
    const status = ctx.requireAttest ? 'awaiting_marker' : 'posted';
    await pool.query(
      `INSERT INTO foursome_posts (tournament_id, foursome_group, posted_by, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE posted_at = CURRENT_TIMESTAMP, posted_by = VALUES(posted_by), status = VALUES(status),
         attested_by = NULL, attested_at = NULL, dispute_note = NULL, disputed_by = NULL, disputed_at = NULL`,
      [tournamentId, group, userId, status]
    );
    const after = await getCardContext(tournamentId, group);
    res.json(cardStatusPayload(after, userId, await isLeagueAdmin(req)));
  } catch (err) {
    console.error('Error posting foursome scores:', { message: err.message, code: err.code, tournamentId, group, userId });
    res.status(500).json({ error: 'Failed to post scores' });
  }
});

// POST /api/scores/tournament/:tournamentId/foursome/:group/attest
// Body: { decision: 'sign' | 'flag', note?: string }
// The marker signs the card (it becomes final) or flags a problem for an admin.
// Admins can also sign, including a flagged card once it's been fixed.
router.post('/tournament/:tournamentId/foursome/:group/attest', requireAuth, requireOpenSeason, async (req, res) => {
  const { tournamentId, group } = req.params;
  const decision = req.body?.decision;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
  if (!['sign', 'flag'].includes(decision)) return res.status(400).json({ error: "decision must be 'sign' or 'flag'" });
  if (decision === 'flag' && !note) return res.status(400).json({ error: 'Please say what looks wrong on the card' });

  try {
    const admin = await isLeagueAdmin(req);
    const ctx = await getCardContext(tournamentId, group);
    const status = cardStatusPayload(ctx, req.user.id, admin);
    if (!ctx.post) return res.status(404).json({ error: 'This card has not been submitted yet' });
    if (!status.can_attest) {
      return res.status(403).json({
        error: ctx.post.status === 'posted'
          ? 'This card is already final.'
          : `Only the marker (${status.marker_names.join(' or ') || 'another player in the foursome'}) can sign this card.`
      });
    }

    if (decision === 'sign') {
      await pool.query(
        `UPDATE foursome_posts SET status = 'posted', attested_by = ?, attested_at = NOW()
         WHERE tournament_id = ? AND foursome_group = ?`,
        [req.user.id, tournamentId, group]
      );
    } else {
      await pool.query(
        `UPDATE foursome_posts SET status = 'disputed', dispute_note = ?, disputed_by = ?, disputed_at = NOW()
         WHERE tournament_id = ? AND foursome_group = ?`,
        [note, req.user.id, tournamentId, group]
      );
    }
    const after = await getCardContext(tournamentId, group);
    res.json(cardStatusPayload(after, req.user.id, admin));
  } catch (err) {
    console.error('Error signing card:', err);
    res.status(500).json({ error: 'Failed to sign the card' });
  }
});

// POST /api/scores/tournament/:tournamentId/foursome/:group/reopen - Admin unlocks a card
// so the foursome can correct it and post again.
router.post('/tournament/:tournamentId/foursome/:group/reopen', requireAdmin, requireOpenSeason, async (req, res) => {
  const { tournamentId, group } = req.params;
  try {
    await pool.query('DELETE FROM foursome_posts WHERE tournament_id = ? AND foursome_group = ?', [tournamentId, group]);
    const after = await getCardContext(tournamentId, group);
    res.json(cardStatusPayload(after, req.user.id, true));
  } catch (err) {
    console.error('Error reopening card:', err);
    res.status(500).json({ error: 'Failed to reopen the card' });
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

