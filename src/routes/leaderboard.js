const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/leaderboard/:tournamentId - Get leaderboard for a tournament
// Calculates total quota points earned vs player's quota and skins
router.get('/:tournamentId', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    // Get tournament details and settings
    const [tournamentInfo] = await pool.query(`
      SELECT t.number_of_holes,
             (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = ? AND paid = 1) as paid_players
      FROM tournament t
      WHERE t.id = ?
    `, [tournamentId, tournamentId]);
    
    const [settingsInfo] = await pool.query('SELECT tournament_fee_18_holes, tournament_fee_9_holes FROM settings LIMIT 1');
    
    const tournament = tournamentInfo[0];
    const settings = settingsInfo[0];
    
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
    
    // Calculate prize money
    const tournamentFee = tournament.number_of_holes === 18 
      ? parseFloat(settings.tournament_fee_18_holes) 
      : parseFloat(settings.tournament_fee_9_holes);
    
    const totalPot = tournament.paid_players * tournamentFee;
    const quotaPrizePot = totalPot / 2; // Half for quota prizes
    
    // Calculate total skins for the tournament
    const totalSkins = Object.values(skins).reduce((sum, skin) => sum + skin.count, 0);
    const skinPrizePot = (totalPot / 2) * 0.6; // 60% of the other half (30% of total pot) for skins
    const skinPricePerSkin = totalSkins > 0 ? skinPrizePot / totalSkins : 0;
    
    // Calculate over/under for each player first
    const playersWithOverUnder = rows.map((player) => {
      const playerSkins = skins[player.id]?.count || 0;
      const overUnder = (parseFloat(player.total_quota_points) || 0) - (parseFloat(player.player_quota) || 0);
      
      return {
        id: player.id,
        name: player.name,
        email: player.email,
        player_quota: parseFloat(player.player_quota) || 0,
        total_quota_points: parseFloat(player.total_quota_points) || 0,
        over_under: overUnder,
        holes_played: player.holes_played,
        total_strokes: player.total_strokes,
        skins: playerSkins,
        skin_holes: skins[player.id]?.holes || []
      };
    });
    
    // Prize percentages for positions 1, 2, 3
    const prizePercentages = [0.5, 0.3, 0.2];
    
    // Calculate quota prize money with tie handling
    const leaderboard = [];
    let currentPosition = 0;
    
    while (currentPosition < playersWithOverUnder.length) {
      // Find all players tied at this position
      const currentOverUnder = playersWithOverUnder[currentPosition].over_under;
      let tiedCount = 1;
      
      while (currentPosition + tiedCount < playersWithOverUnder.length &&
             playersWithOverUnder[currentPosition + tiedCount].over_under === currentOverUnder) {
        tiedCount++;
      }
      
      // Calculate pooled prize percentage for tied positions
      let pooledPrizePercentage = 0;
      for (let i = 0; i < tiedCount; i++) {
        const prizePosition = currentPosition + i;
        if (prizePosition < prizePercentages.length) {
          pooledPrizePercentage += prizePercentages[prizePosition];
        }
      }
      
      // Divide pooled prize among tied players
      const prizePerPlayer = pooledPrizePercentage / tiedCount;
      const quotaPrizeMoney = Math.floor(quotaPrizePot * prizePerPlayer);
      
      // Add all tied players with the same rank and prize
      for (let i = 0; i < tiedCount; i++) {
        const player = playersWithOverUnder[currentPosition + i];
        const skinPrizeMoney = Math.floor(player.skins * skinPricePerSkin);
        
        leaderboard.push({
          rank: currentPosition + 1,
          id: player.id,
          name: player.name,
          email: player.email,
          player_quota: player.player_quota,
          total_quota_points: player.total_quota_points,
          over_under: player.over_under,
          holes_played: player.holes_played,
          total_strokes: player.total_strokes,
          skins: player.skins,
          skin_holes: player.skin_holes,
          quota_prize_money: quotaPrizeMoney,
          skin_prize_money: skinPrizeMoney
        });
      }
      
      currentPosition += tiedCount;
    }
    
    res.json(leaderboard);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
