const express = require('express');
const pool = require('../db');
const { getLeagueId } = require('../utils/league');
const router = express.Router();

function calculateRecentAverageQuota(playerRow, holeCount) {
  const points = [];

  for (let i = 1; i <= 7; i++) {
    const pointsRaw = playerRow[`points_${i}`];
    const holesRaw = playerRow[`holes_${i}`];

    if (pointsRaw === null || pointsRaw === undefined || pointsRaw === '') {
      continue;
    }

    const pointsValue = Number(pointsRaw);
    const holesValue = Number(holesRaw);

    if (Number.isNaN(pointsValue) || holesValue !== holeCount) {
      continue;
    }

    points.push(pointsValue);
  }

  if (points.length === 0) {
    return null;
  }

  return Math.floor(points.reduce((sum, value) => sum + value, 0) / points.length);
}

// GET /api/leaderboard/:tournamentId - Get leaderboard for a tournament
// Calculates total quota points earned vs player's quota and skins
router.get('/:tournamentId', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    // Get tournament details and settings
    const [tournamentInfo] = await pool.query(`
      SELECT t.number_of_holes,
             t.season_id,
             ls.season_year,
             ls.champion_tiebreak_player_id,
             t.playoff_stage,
             t.playoff_override_semifinal_player_ids,
             t.playoff_override_final_player_ids,
             t.quota_collected,
             t.skins_collected,
             CASE
               WHEN EXISTS (SELECT 1 FROM tournament_paradise_points tpp WHERE tpp.tournament_id = t.id)
               THEN 1 ELSE 0
             END AS is_completed,
             (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = ? AND paid = 1) as paid_players,
             (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = ? AND skins_ctp_paid = 1) as skins_ctp_players
      FROM tournament t
                LEFT JOIN league_seasons ls ON ls.id = t.season_id
      WHERE t.id = ?
    `, [tournamentId, tournamentId, tournamentId]);
    
    const [settingsInfo] = await pool.query('SELECT tournament_fee_18_holes, tournament_fee_9_holes, skins_ctp_fee_18_holes, skins_ctp_fee_9_holes, live_scoring FROM league_settings WHERE league_id = ? LIMIT 1', [getLeagueId(req)]);
    
    const tournament = tournamentInfo[0];
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const holeCount = Number(tournament?.number_of_holes);
    const isCompleted = Number(tournament?.is_completed || 0) === 1;
    const settings = settingsInfo[0];
    const liveScoring = !settings || settings.live_scoring == null ? true : Boolean(settings.live_scoring);

    // Calculate prize money pots up front (used by both saved and fallback winner paths)
    const tournamentFee = Number(
      holeCount === 18
        ? settings.tournament_fee_18_holes
        : settings.tournament_fee_9_holes
    ) || 0;

    const skinsCTPFee = Number(
      holeCount === 18
        ? settings.skins_ctp_fee_18_holes
        : settings.skins_ctp_fee_9_holes
    ) || 0;

    const quotaPrizePot = tournament.quota_collected != null
      ? Number(tournament.quota_collected)
      : tournament.paid_players * tournamentFee;
    const skinsCTPTotalPot = tournament.skins_collected != null
      ? Number(tournament.skins_collected)
      : tournament.skins_ctp_players * skinsCTPFee;
    const SKINS_PCT = 0.6;
    const CTP_PCT = 0.4;
    const skinPrizePot = skinsCTPTotalPot * SKINS_PCT;
    const ctpPrizePot = skinsCTPTotalPot * CTP_PCT;
    
    // Determine which quota to use based on tournament holes (validated whitelist)
    const quotaColumn = holeCount === 9 ? 'quota_9' : 'quota_18';
    
    // Validate quota column to prevent SQL injection
    if (quotaColumn !== 'quota_9' && quotaColumn !== 'quota_18') {
      return res.status(400).json({ error: 'Invalid quota column' });
    }
    
    // Always fetch all scores — frontend controls visibility based on liveScoring + completeness
    const scoreJoinClause = `LEFT JOIN scores s ON p.id = s.player_id AND s.tournament_id = ?`;

    const [rows] = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.email,
        tp.tournament_quota,
        p.${quotaColumn} as default_player_quota,
        q.points_1,
        q.points_2,
        q.points_3,
        q.points_4,
        q.points_5,
        q.points_6,
        q.points_7,
        q.holes_1,
        q.holes_2,
        q.holes_3,
        q.holes_4,
        q.holes_5,
        q.holes_6,
        q.holes_7,
        tpp.place AS finalized_place,
        tpp.player_quota AS finalized_player_quota,
        tpp.over_under AS finalized_over_under,
        tpp.total_quota_points AS finalized_total_quota_points,
        COALESCE(SUM(s.quota), 0) as total_quota_points,
        COUNT(DISTINCT s.hole_id) as holes_played,
        COALESCE(SUM(s.score), 0) as total_strokes
      FROM players p
      JOIN tournament_players tp ON p.id = tp.player_id
      LEFT JOIN quota q ON q.player_id = p.id
      LEFT JOIN tournament_paradise_points tpp
        ON tpp.tournament_id = tp.tournament_id
       AND tpp.player_id = p.id
      ${scoreJoinClause}
      WHERE tp.tournament_id = ? AND p.active = 1
      GROUP BY p.id, p.name, p.email, tp.tournament_quota, p.${quotaColumn},
               q.points_1, q.points_2, q.points_3, q.points_4, q.points_5, q.points_6, q.points_7,
               q.holes_1, q.holes_2, q.holes_3, q.holes_4, q.holes_5, q.holes_6, q.holes_7,
               tpp.place, tpp.player_quota, tpp.over_under, tpp.total_quota_points
    `, [tournamentId, tournamentId]);
    
    const skins = {};
    const ctpPrizes = {};

    const [savedSkinWinners] = await pool.query(
      `SELECT player_id, hole_number, prize_money
       FROM tournament_skin_winners
       WHERE tournament_id = ?
       ORDER BY hole_number ASC`,
      [tournamentId]
    );

    const [savedCtpWinners] = await pool.query(
      `SELECT player_id, hole_number, prize_money
       FROM tournament_ctp_winners
       WHERE tournament_id = ?
       ORDER BY hole_number ASC`,
      [tournamentId]
    );

    if (savedSkinWinners.length > 0) {
      savedSkinWinners.forEach((winner) => {
        if (!skins[winner.player_id]) {
          skins[winner.player_id] = {
            count: 0,
            holes: [],
            prize: 0
          };
        }

        skins[winner.player_id].count++;
        skins[winner.player_id].holes.push(winner.hole_number);
      });

      const hasExplicitSkinPrizes = savedSkinWinners.some((winner) => Number(winner.prize_money || 0) > 0);
      if (hasExplicitSkinPrizes) {
        savedSkinWinners.forEach((winner) => {
          skins[winner.player_id].prize += Number(winner.prize_money || 0);
        });
      } else {
        const totalSkins = Object.values(skins).reduce((sum, skin) => sum + skin.count, 0);
        const skinPricePerSkin = totalSkins > 0 ? Math.floor(skinPrizePot / totalSkins) : 0;
        Object.keys(skins).forEach((playerId) => {
          skins[playerId].prize = skins[playerId].count * skinPricePerSkin;
        });
      }
    } else {
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
        JOIN tournament_players tp ON tp.tournament_id = s.tournament_id AND tp.player_id = s.player_id
        WHERE s.tournament_id = ? AND p.active = 1 AND tp.skins_ctp_paid = 1
        ORDER BY s.hole_id, s.score ASC
      `, [tournamentId]);

      const holeGroups = {};
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

      Object.keys(holeGroups).forEach(holeId => {
        const hole = holeGroups[holeId];
        const sortedScores = hole.scores.sort((a, b) => a.score - b.score);

        if (sortedScores.length > 0) {
          const bestScore = sortedScores[0].score;
          const winners = sortedScores.filter(s => s.score === bestScore);

          if (winners.length === 1) {
            const winnerId = winners[0].player_id;
            if (!skins[winnerId]) {
              skins[winnerId] = {
                count: 0,
                holes: [],
                prize: 0
              };
            }
            skins[winnerId].count++;
            skins[winnerId].holes.push(hole.hole_number);
          }
        }
      });

      const totalSkins = Object.values(skins).reduce((sum, skin) => sum + skin.count, 0);
      const skinPricePerSkin = totalSkins > 0 ? Math.floor(skinPrizePot / totalSkins) : 0;
      Object.keys(skins).forEach((playerId) => {
        skins[playerId].prize = skins[playerId].count * skinPricePerSkin;
      });
    }

    if (savedCtpWinners.length > 0) {
      const normalizedSavedCtpWinners = [];
      const seenCtpHoles = new Set();
      const sortedSavedCtpWinners = [...savedCtpWinners].sort(
        (a, b) => Number(a.hole_number) - Number(b.hole_number)
      );

      for (const winner of sortedSavedCtpWinners) {
        const holeNumber = Number(winner.hole_number);
        if (!Number.isFinite(holeNumber) || seenCtpHoles.has(holeNumber)) {
          continue;
        }

        seenCtpHoles.add(holeNumber);
        normalizedSavedCtpWinners.push(winner);

        if (holeCount === 9 && normalizedSavedCtpWinners.length >= 2) {
          break;
        }
      }

      normalizedSavedCtpWinners.forEach((winner) => {
        if (!ctpPrizes[winner.player_id]) {
          ctpPrizes[winner.player_id] = {
            count: 0,
            prize: 0,
            holes: []
          };
        }

        ctpPrizes[winner.player_id].count++;
        ctpPrizes[winner.player_id].holes.push(winner.hole_number);
      });

      const explicitCtpPrizeTotal = normalizedSavedCtpWinners.reduce(
        (sum, winner) => sum + Number(winner.prize_money || 0),
        0
      );
      const hasExplicitCtpPrizes = explicitCtpPrizeTotal > 0;
      const canUseExplicitCtpPrizes = hasExplicitCtpPrizes && explicitCtpPrizeTotal <= ctpPrizePot + 0.01;
      if (canUseExplicitCtpPrizes) {
        normalizedSavedCtpWinners.forEach((winner) => {
          ctpPrizes[winner.player_id].prize += Number(winner.prize_money || 0);
        });
      } else {
        const ctpWinnerCount = normalizedSavedCtpWinners.length;
        const ctpPrizePerWinner = ctpWinnerCount > 0 ? Math.floor(ctpPrizePot / ctpWinnerCount) : 0;
        Object.keys(ctpPrizes).forEach((playerId) => {
          ctpPrizes[playerId].prize = ctpPrizes[playerId].count * ctpPrizePerWinner;
        });
      }
    } else {
      const [ctpWinners] = await pool.query(`
        SELECT 
          h.id as hole_id,
          h.hole_number,
          s.player_id,
          p.name as player_name,
          s.ctp_feet,
          s.ctp_inches,
          (s.ctp_feet * 12 + s.ctp_inches) as total_inches
        FROM scores s
        JOIN hole h ON s.hole_id = h.id
        JOIN hole_tee ht_par ON ht_par.hole_id = h.id AND ht_par.par = 3
        JOIN players p ON s.player_id = p.id
        JOIN tournament_players tp ON tp.tournament_id = s.tournament_id AND tp.player_id = s.player_id
        WHERE s.tournament_id = ? 
          AND s.ctp_feet IS NOT NULL
          AND p.active = 1
          AND tp.skins_ctp_paid = 1
        ORDER BY h.hole_number, total_inches ASC
      `, [tournamentId]);

      const ctpByHole = {};
      ctpWinners.forEach(ctp => {
        if (!ctpByHole[ctp.hole_number]) {
          ctpByHole[ctp.hole_number] = ctp;
        }
      });

      let ctpWinningHoles = Object.keys(ctpByHole)
        .map(Number)
        .sort((a, b) => a - b);

      if (holeCount === 9) {
        ctpWinningHoles = ctpWinningHoles.slice(0, 2);
      }

      const ctpWinnerCount = ctpWinningHoles.length;
      const ctpPrizePerWinner = ctpWinnerCount > 0 ? Math.floor(ctpPrizePot / ctpWinnerCount) : 0;

      ctpWinningHoles.forEach((holeNumber) => {
        const winner = ctpByHole[holeNumber];
        if (!ctpPrizes[winner.player_id]) {
          ctpPrizes[winner.player_id] = {
            count: 0,
            prize: 0,
            holes: []
          };
        }
        ctpPrizes[winner.player_id].count++;
        ctpPrizes[winner.player_id].prize += ctpPrizePerWinner;
        ctpPrizes[winner.player_id].holes.push(winner.hole_number);
      });
    }
    // Calculate over/under for each player first
    const playersWithOverUnder = rows.map((player) => {
      const playerSkins = skins[player.id]?.count || 0;
      const fallbackQuota = parseFloat(player.tournament_quota ?? player.default_player_quota) || 0;
      const hasFinalizedValues = player.finalized_player_quota !== null && player.finalized_over_under !== null;

      // For completed tournaments, freeze to finalized values so standings never drift.
      const playerQuota = isCompleted
        ? (hasFinalizedValues ? (parseFloat(player.finalized_player_quota) || 0) : fallbackQuota)
        : (calculateRecentAverageQuota(player, holeCount) ?? fallbackQuota);

      const totalQuotaPoints = isCompleted && player.finalized_total_quota_points !== null
        ? (parseFloat(player.finalized_total_quota_points) || 0)
        : (parseFloat(player.total_quota_points) || 0);

      const overUnder = isCompleted
        ? (hasFinalizedValues
          ? (parseFloat(player.finalized_over_under) || 0)
          : (totalQuotaPoints - playerQuota))
        : (totalQuotaPoints - playerQuota);
      
      return {
        id: player.id,
        name: player.name,
        email: player.email,
        player_quota: playerQuota,
        total_quota_points: totalQuotaPoints,
        over_under: overUnder,
        finalized_place: player.finalized_place != null ? Number(player.finalized_place) : null,
        holes_played: player.holes_played,
        total_strokes: player.total_strokes,
        skins: playerSkins,
        skin_holes: skins[player.id]?.holes || []
      };
    });

    playersWithOverUnder.sort((a, b) => {
      if (isCompleted) {
        const aHasPlace = a.finalized_place != null;
        const bHasPlace = b.finalized_place != null;
        if (aHasPlace && bHasPlace && a.finalized_place !== b.finalized_place) {
          return a.finalized_place - b.finalized_place;
        }
        if (aHasPlace !== bHasPlace) {
          return aHasPlace ? -1 : 1;
        }
      }
      if (b.holes_played !== a.holes_played) return b.holes_played - a.holes_played;
      if (b.over_under !== a.over_under) return b.over_under - a.over_under;
      return String(a.name).localeCompare(String(b.name));
    });

    // Count players with complete scores vs total players
    const totalPlayersCount = rows.length;
    const completeScoresCount = rows.filter(p => p.holes_played >= holeCount).length;
    
    // Prize percentages for positions 1, 2, 3
    const prizePercentages = [0.5, 0.3, 0.2];
    
    // Calculate quota prize money with tie handling
    // Only rank players who have scores entered
    const playersWithScores = playersWithOverUnder.filter(p => p.holes_played > 0);
    const playersWithoutScores = playersWithOverUnder.filter(p => p.holes_played === 0);
    
    const leaderboard = [];
    let currentPosition = 0;
    
    while (currentPosition < playersWithScores.length) {
      // Find all players tied at this position
      const currentOverUnder = playersWithScores[currentPosition].over_under;
      let tiedCount = 1;
      
      while (currentPosition + tiedCount < playersWithScores.length &&
             playersWithScores[currentPosition + tiedCount].over_under === currentOverUnder) {
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
        const player = playersWithScores[currentPosition + i];
        const skinPrizeMoney = Math.floor(skins[player.id]?.prize || 0);
        const ctpPrizeMoney = ctpPrizes[player.id]?.prize || 0;
        const ctpWins = ctpPrizes[player.id]?.count || 0;
        const ctpHoles = ctpPrizes[player.id]?.holes || [];
        
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
          ctp_wins: ctpWins,
          ctp_holes: ctpHoles,
          quota_prize_money: quotaPrizeMoney,
          skin_prize_money: skinPrizeMoney,
          ctp_prize_money: ctpPrizeMoney,
          skins_ctp_paid_players: Number(tournament.skins_ctp_players) || 0,
          skins_ctp_fee: skinsCTPFee,
          skins_ctp_total_pot: Number(skinsCTPTotalPot.toFixed(2)),
          skin_prize_pot: Number(skinPrizePot.toFixed(2)),
          ctp_prize_pot: Number(ctpPrizePot.toFixed(2)),
          quota_collected: tournament.quota_collected != null ? Number(tournament.quota_collected) : null,
          skins_collected: tournament.skins_collected != null ? Number(tournament.skins_collected) : null
        });
      }
      
      currentPosition += tiedCount;
    }
    
    // Add players without scores at the end (no rank)
    playersWithoutScores.forEach((player) => {
      leaderboard.push({
        rank: null,
        id: player.id,
        name: player.name,
        email: player.email,
        player_quota: player.player_quota,
        total_quota_points: 0,
        over_under: 0,
        holes_played: 0,
        total_strokes: 0,
        skins: 0,
        skin_holes: [],
        ctp_wins: 0,
        ctp_holes: [],
        quota_prize_money: 0,
        skin_prize_money: 0,
        ctp_prize_money: 0,
        skins_ctp_paid_players: Number(tournament.skins_ctp_players) || 0,
        skins_ctp_fee: skinsCTPFee,
        skins_ctp_total_pot: Number(skinsCTPTotalPot.toFixed(2)),
        skin_prize_pot: Number(skinPrizePot.toFixed(2)),
        ctp_prize_pot: Number(ctpPrizePot.toFixed(2)),
        quota_collected: tournament.quota_collected != null ? Number(tournament.quota_collected) : null,
        skins_collected: tournament.skins_collected != null ? Number(tournament.skins_collected) : null
      });
    });

    let playoff = null;

    if (tournament.playoff_stage && tournament.playoff_stage !== 'regular' && tournament.season_id) {
      const [seasonRows] = await pool.query(
        `SELECT
           sps.player_id,
           p.name,
           sps.regular_points,
           sps.playoff_points,
           sps.losers_bracket_points,
           (COALESCE(sps.regular_points, 0) + COALESCE(sps.playoff_points, 0) + COALESCE(sps.losers_bracket_points, 0)) AS total_points
         FROM season_player_stats sps
         JOIN players p ON p.id = sps.player_id
         WHERE sps.season_id = ?
         ORDER BY total_points DESC, sps.regular_points DESC, p.name ASC`,
        [tournament.season_id]
      );

      const [playoffRows] = await pool.query(
        `SELECT
           tpp.player_id,
           p.name,
           tpp.bracket_type,
           tpp.result_type,
           tpp.playoff_week,
           tpp.rank_position,
           tpp.tie_group_size,
           tpp.over_under,
           tpp.points_awarded,
           tpp.cumulative_points_after
         FROM tournament_playoff_points tpp
         JOIN players p ON p.id = tpp.player_id
         WHERE tpp.tournament_id = ?
         ORDER BY tpp.bracket_type ASC, tpp.playoff_week ASC, tpp.rank_position ASC, p.name ASC`,
        [tournamentId]
      );

      const playoffResults = playoffRows.filter((row) => row.bracket_type === 'playoff');
      const losersResults = playoffRows.filter((row) => row.bracket_type === 'losers');
      const playoffWeek = playoffRows.length > 0 ? Number(playoffRows[0].playoff_week) || null : null;
      let allowedLosersPlayerIds = null;

      if (tournament.playoff_stage === 'final') {
        const [previousPlayoffRows] = await pool.query(
          `SELECT id
           FROM tournament
           WHERE season_id = ?
             AND id <> ?
             AND playoff_stage IN ('semifinal', 'final')
           ORDER BY date DESC, id DESC
           LIMIT 1`,
          [tournament.season_id, tournamentId]
        );

        const sourceTournamentIds = [Number(tournamentId)];
        if (previousPlayoffRows.length > 0) {
          sourceTournamentIds.push(Number(previousPlayoffRows[0].id));
        }

        const placeholders = sourceTournamentIds.map(() => '?').join(', ');
        const [loserParticipantRows] = await pool.query(
          `SELECT DISTINCT player_id
           FROM tournament_playoff_points
           WHERE bracket_type = 'losers'
             AND tournament_id IN (${placeholders})`,
          sourceTournamentIds
        );

        allowedLosersPlayerIds = new Set(
          loserParticipantRows
            .map((row) => Number(row.player_id))
            .filter((playerId) => Number.isInteger(playerId))
        );
      }

      const losersStandings = seasonRows
        .map((row) => ({
          player_id: Number(row.player_id),
          name: row.name,
          losers_bracket_points: Number(row.losers_bracket_points) || 0
        }))
        .filter((row) => {
          if (row.losers_bracket_points <= 0) {
            return false;
          }

          if (!allowedLosersPlayerIds) {
            return true;
          }

          return allowedLosersPlayerIds.has(Number(row.player_id));
        })
        .sort((a, b) => {
          if (b.losers_bracket_points !== a.losers_bracket_points) {
            return b.losers_bracket_points - a.losers_bracket_points;
          }
          return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .map((row, index) => ({
          player_id: row.player_id,
          name: row.name,
          bracket_type: 'losers',
          rank_position: index + 1,
          playoff_week: playoffWeek,
          over_under: null,
          points_awarded: row.losers_bracket_points,
          cumulative_points_after: row.losers_bracket_points
        }));

      playoff = {
        seasonId: Number(tournament.season_id),
        seasonYear: tournament.season_year != null ? Number(tournament.season_year) : null,
        stage: tournament.playoff_stage,
        semifinalOverridePlayerIds: Array.isArray(tournament.playoff_override_semifinal_player_ids)
          ? tournament.playoff_override_semifinal_player_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
          : [],
        finalOverridePlayerIds: Array.isArray(tournament.playoff_override_final_player_ids)
          ? tournament.playoff_override_final_player_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
          : [],
        championTiebreakPlayerId: Number(tournament.champion_tiebreak_player_id) || null,
        standings: seasonRows.map((row, index) => ({
          rank: index + 1,
          playerId: row.player_id,
          name: row.name,
          regularPoints: Number(row.regular_points) || 0,
          playoffPoints: Number(row.playoff_points) || 0,
          losersBracketPoints: Number(row.losers_bracket_points) || 0,
          totalPoints: Number(row.total_points) || 0
        })),
        playoffResults,
        losersResults,
        losersStandings,
        playoffWeek
      };
    }
    
    res.json({
      leaderboard,
      totalPlayers: totalPlayersCount,
      playersWithCompleteScores: completeScoresCount,
      expectedHoles: holeCount,
      liveScoring,
      playoff
    });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
