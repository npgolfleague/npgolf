// Same rules as the server (src/utils/leagueQuota.js).
const isSet = (value) => value !== null && value !== undefined && value !== ''

// The quota for a round; a missing length comes from the other one.
export const quotaForHoles = (player, holes) => {
  const nine = isSet(player?.quota_9) ? Number(player.quota_9) : null
  const eighteen = isSet(player?.quota_18) ? Number(player.quota_18) : null
  if (Number(holes) === 9) return nine ?? (eighteen === null ? null : Math.floor(eighteen / 2))
  return eighteen ?? (nine === null ? null : nine * 2)
}

// What a round counts toward each quota.
export const roundValue = (points, playedHoles, quotaHoles) => {
  if (!isSet(points) || !isSet(playedHoles)) return null
  if (Number(playedHoles) === Number(quotaHoles)) return Number(points)
  return Number(quotaHoles) === 9 ? Math.floor(Number(points) / 2) : Number(points) * 2
}
