// Quota points for a hole, from the score, the par for the player's tee and the
// league's points table. The server works these out; what a device sends is ignored.

const DEFAULT_TABLE = Object.freeze({ albatross: 8, eagle: 6, birdie: 4, par: 2, bogey: 1, double_bogey: 0, worse: 0 });

const pointsForScore = (score, par, table = DEFAULT_TABLE) => {
  const relative = Number(score) - Number(par);
  if (Number(score) === 1 || relative <= -3) return table.albatross;
  if (relative === -2) return table.eagle;
  if (relative === -1) return table.birdie;
  if (relative === 0) return table.par;
  if (relative === 1) return table.bogey;
  if (relative === 2) return table.double_bogey;
  return table.worse;
};

const loadPointsTable = async (db, tournamentId) => {
  const [rows] = await db.query(
    `SELECT ls.quota_points_albatross AS albatross, ls.quota_points_eagle AS eagle, ls.quota_points_birdie AS birdie,
            ls.quota_points_par AS par, ls.quota_points_bogey AS bogey,
            ls.quota_points_double_bogey AS double_bogey, ls.quota_points_worse AS worse
     FROM tournament t JOIN league_settings ls ON ls.league_id = t.league_id
     WHERE t.id = ? LIMIT 1`,
    [tournamentId]
  );
  const table = { ...DEFAULT_TABLE };
  Object.keys(table).forEach((k) => {
    if (rows[0] && rows[0][k] !== null && rows[0][k] !== undefined) table[k] = Number(rows[0][k]);
  });
  return table;
};

// Par of a hole for a player: their tee in this round, otherwise the first tee
// for their gender, otherwise any tee. Null when the hole isn't on the course.
const loadPar = async (db, tournamentId, playerId, holeId) => {
  const [rows] = await db.query(
    `SELECT ht.par
     FROM tournament t
     JOIN hole h ON h.course_id = t.course_id AND h.id = ?
     JOIN hole_tee ht ON ht.hole_id = h.id
     JOIN course_tee ct ON ct.id = ht.tee_id
     JOIN players p ON p.id = ?
     LEFT JOIN tournament_players tp ON tp.tournament_id = t.id AND tp.player_id = p.id
     WHERE t.id = ?
     ORDER BY (ht.tee_id <=> tp.tee_id) DESC,
              (ct.gender <=> IF(p.sex = 'F', 'F', 'M')) DESC,
              ct.id ASC
     LIMIT 1`,
    [holeId, playerId, tournamentId]
  );
  return rows.length > 0 ? Number(rows[0].par) : null;
};

module.exports = { DEFAULT_TABLE, pointsForScore, loadPointsTable, loadPar };
