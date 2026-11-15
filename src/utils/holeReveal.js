// Which holes' results may be shown while a tournament is in play.
//
// A hole is revealed only once every player in the round has a score on it,
// so nobody can see how others did on a hole before finishing it themselves.
// "Every player" means everyone placed in a foursome (and not marked as not
// attending), plus anyone else who has entered a score. A no-show who is still
// in a foursome keeps holes hidden until an admin drops them from the foursome.
// If no foursomes were set up, it falls back to everyone who has entered a score.
//
// Once the tournament is completed, every hole is revealed.

const getHoleReveal = async (db, tournamentId) => {
  const [tournamentRows] = await db.query(
    `SELECT t.id,
            EXISTS (SELECT 1 FROM tournament_paradise_points x WHERE x.tournament_id = t.id) AS completed
     FROM tournament t
     WHERE t.id = ?`,
    [tournamentId]
  );
  const tournament = tournamentRows[0];
  if (!tournament) return null;
  if (Number(tournament.completed) === 1) {
    return { all: true, holeIds: new Set(), expectedPlayers: 0 };
  }

  const [revealedRows] = await db.query(
    `SELECT s.hole_id, COUNT(DISTINCT s.player_id) AS players_scored, MAX(e.expected) AS expected
     FROM scores s
     JOIN (
       SELECT COUNT(*) AS expected
       FROM (
         SELECT tp.player_id FROM tournament_players tp
          WHERE tp.tournament_id = ? AND tp.foursome IS NOT NULL AND tp.foursome <> ''
            AND (tp.attending_status IS NULL OR tp.attending_status <> 'no')
         UNION
         SELECT DISTINCT s2.player_id FROM scores s2 WHERE s2.tournament_id = ?
       ) everyone
     ) e
     WHERE s.tournament_id = ?
     GROUP BY s.hole_id
     HAVING players_scored >= expected`,
    [tournamentId, tournamentId, tournamentId]
  );

  return {
    all: false,
    holeIds: new Set(revealedRows.map((r) => Number(r.hole_id))),
    expectedPlayers: revealedRows[0] ? Number(revealedRows[0].expected) : null
  };
};

// The tournaments, foursomes and own player id a signed-in player may always
// see in full (their own scores and their own foursome's card).
const isScoreVisibleToPlayer = (row, reveal, userId, userFoursomes) => {
  if (!reveal || reveal.all) return true;
  if (Number(row.player_id) === Number(userId)) return true;
  if (row.foursome_group && userFoursomes.has(String(row.foursome_group))) return true;
  return reveal.holeIds.has(Number(row.hole_id));
};

// Foursomes the user is in for a tournament: the one assigned in Tournament
// Players, plus any group they have entered their own scores under.
const getUserFoursomes = async (db, tournamentId, userId) => {
  const [rows] = await db.query(
    `SELECT foursome AS g FROM tournament_players
      WHERE tournament_id = ? AND player_id = ? AND foursome IS NOT NULL AND foursome <> ''
     UNION
     SELECT DISTINCT foursome_group AS g FROM scores
      WHERE tournament_id = ? AND player_id = ? AND foursome_group IS NOT NULL AND foursome_group <> ''`,
    [tournamentId, userId, tournamentId, userId]
  );
  return new Set(rows.map((r) => String(r.g)));
};

module.exports = { getHoleReveal, isScoreVisibleToPlayer, getUserFoursomes };
