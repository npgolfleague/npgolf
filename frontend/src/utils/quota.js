// Same rule as the server: a player's own 18-hole quota, otherwise twice the
// nine-hole quota.
export const eighteenHoleQuota = (player) => {
  if (player?.quota_18 !== null && player?.quota_18 !== undefined && player.quota_18 !== '') return player.quota_18
  if (player?.quota_9 === null || player?.quota_9 === undefined || player.quota_9 === '') return null
  return Number(player.quota_9) * 2
}
