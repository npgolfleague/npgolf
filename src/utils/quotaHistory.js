// Saves a completed round in a player's history (quota keeps 7 rounds,
// skins_quota 20), newest first. Completing a round again replaces its entry
// instead of adding another.

const dateKey = (value) => {
  if (!value) return '';
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const slotsOf = (row, size) => Array.from({ length: size }, (_unused, i) => ({
  date: row?.[`date_${i + 1}`] ?? null,
  points: row?.[`points_${i + 1}`] ?? null,
  quota_diff: row?.[`quota_diff_${i + 1}`] ?? null,
  holes: row?.[`holes_${i + 1}`] ?? null
})).filter((slot) => slot.date !== null || slot.points !== null);

// slots:  the player's rounds, newest first
// round:  the new result { date, points, quota_diff, holes }, or null when the
//         player no longer has a score in this round
// earlierPoints: points from the last time this round was completed, or null
const applyRound = (slots, round, earlierPoints, date, size) => {
  if (earlierPoints === null || earlierPoints === undefined) return round ? [round, ...slots].slice(0, size) : slots;
  const at = slots.findIndex((slot) => dateKey(slot.date) === dateKey(date) && Number(slot.points) === Number(earlierPoints));
  // Already dropped off the end: nothing to correct.
  if (at === -1) return slots;
  return round
    ? slots.map((slot, i) => (i === at ? round : slot))
    : slots.filter((_slot, i) => i !== at);
};

// table is always 'quota' or 'skins_quota' (constants in the code). Returns the saved rounds
// as a history row.
const saveRound = async (db, table, { playerId, leagueId, round, earlierPoints = null, date }) => {
  const size = table === 'quota' ? 7 : 20;
  const fields = table === 'quota' ? ['date', 'points', 'quota_diff', 'holes'] : ['date', 'points', 'quota_diff'];
  const [rows] = await db.query(`SELECT * FROM ${table} WHERE player_id = ? AND league_id = ? LIMIT 1`, [playerId, leagueId]);
  const slots = applyRound(slotsOf(rows[0], size), round, earlierPoints, date, size);

  const columns = [];
  const values = [];
  const row = {};
  for (let i = 1; i <= size; i += 1) {
    for (const field of fields) {
      const value = slots[i - 1]?.[field] ?? null;
      columns.push(`${field}_${i}`);
      values.push(value);
      row[`${field}_${i}`] = value;
    }
  }
  if (rows.length === 0) {
    await db.query(
      `INSERT INTO ${table} (player_id, league_id, ${columns.join(', ')}) VALUES (?, ?, ${columns.map(() => '?').join(', ')})`,
      [playerId, leagueId, ...values]
    );
  } else {
    await db.query(
      `UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE player_id = ? AND league_id = ?`,
      [...values, playerId, leagueId]
    );
  }
  return row;
};

module.exports = { applyRound, saveRound, slotsOf };
