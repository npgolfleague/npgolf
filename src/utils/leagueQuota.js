// A player's quota for a round. Nine-hole rounds use the nine-hole quota.
// Eighteen-hole rounds use the player's own 18-hole quota when there is one,
// otherwise twice the nine-hole quota (worked out each time, never stored).

const quotaForHoles = (player, holes) => {
  if (!player) return null;
  if (Number(holes) === 9) return player.quota_9 ?? null;
  if (player.quota_18 !== null && player.quota_18 !== undefined) return player.quota_18;
  return player.quota_9 === null || player.quota_9 === undefined ? null : Number(player.quota_9) * 2;
};

// The same rule in SQL. `alias` is the league_players alias, always a constant.
const quotaSql = (holes, alias = 'lp') => (
  Number(holes) === 9 ? `${alias}.quota_9` : `COALESCE(${alias}.quota_18, ${alias}.quota_9 * 2)`
);

// True when an 18-hole round must not touch this player's history: it holds
// nine-hole rounds, which an 18-hole total would inflate. Players who play
// 18-hole rounds regularly keep updating as usual.
const keepsNineHoleHistory = (player, history, holes) => {
  if (Number(holes) === 9 || player?.quota_9 === null || player?.quota_9 === undefined) return false;
  const played = [1, 2, 3, 4, 5, 6, 7].map((i) => Number(history?.[`holes_${i}`]));
  if (played.includes(18)) return false;
  return played.includes(9) || player.quota_18 === null || player.quota_18 === undefined;
};

module.exports = { quotaForHoles, quotaSql, keepsNineHoleHistory };
