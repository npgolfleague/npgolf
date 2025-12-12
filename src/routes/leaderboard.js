const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/leaderboard/:tournamentId - Get leaderboard for a tournament
// Calculates total quota points earned vs player's quota and skins
router.get('/:tournamentId', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    // Get all scores for the tournament with player info
    const [rows] = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.email,
        p.quota as player_quota,
        SUM(s.quota) as total_quota_points,
        COUNT(DISTINCT s.hole_id) as holes_played,
        SUM(s.score) as total_strokes
      FROM players p
      JOIN tournament_players tp ON p.id = tp.player_id
      LEFT JOIN scores s ON p.id = s.player_id AND s.tournament_id = ?
      WHERE tp.tournament_id = ?
      GROUP BY p.id, p.name, p.email, p.quota
      HAVING holes_played > 0
      ORDER BY (total_quota_points - player_quota) DESC, p.name ASC
    `, [tournamentId, tournamentId]);
    
    // Calculate skins - get best score for each hole
    const [holeScores] = await pool.query(`
      SELECT 
        s.hole_id,
        h.hole_number,
        s.player_id,
        s.score,
        p.name as player_name
      FROM scores s
      JOIN hole h ON s.hole_id = h.id
      JOIN players p ON s.player_id = p.id
      WHERE s.tournament_id = ?
      ORDER BY s.hole_id, s.score ASC
    `, [tournamentId]);
    
    // Calculate skins per player
    const skins = {};
    const holeGroups = {};
    
    // Group scores by hole
    holeScores.forEach(score => {
      if (!holeGroups[score.hole_id]) {
        holeGroups[score.hole_id] = {
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
    
    // Determine skin winners (only player with best score on a hole)
    Object.keys(holeGroups).forEach(holeId => {
      const hole = holeGroups[holeId];
      const sortedScores = hole.scores.sort((a, b) => a.score - b.score);
      
      if (sortedScores.length > 0) {
        const bestScore = sortedScores[0].score;
        const winners = sortedScores.filter(s => s.score === bestScore);
        
        // Only award skin if one player has the best score
        if (winners.length === 1) {
          const winnerId = winners[0].player_id;
          if (!skins[winnerId]) {
            skins[winnerId] = {
              count: 0,
              holes: []
            };
          }
          skins[winnerId].count++;
          skins[winnerId].holes.push(hole.hole_number);
        }
      }
    });
    
    // Calculate over/under quota for each player and add skins
    const leaderboard = rows.map((player, index) => ({
      rank: index + 1,
      id: player.id,
      name: player.name,
      email: player.email,
      player_quota: parseFloat(player.player_quota) || 0,
      total_quota_points: parseFloat(player.total_quota_points) || 0,
      over_under: (parseFloat(player.total_quota_points) || 0) - (parseFloat(player.player_quota) || 0),
      holes_played: player.holes_played,
      total_strokes: player.total_strokes,
      skins: skins[player.id]?.count || 0,
      skin_holes: skins[player.id]?.holes || []
    }));
    
    res.json(leaderboard);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
