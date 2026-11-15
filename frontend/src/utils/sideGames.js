// Display helpers for side games. The rules themselves live on the server
// (src/utils/sideGames.js); keep these descriptions in step with them.

export const SIDE_GAME_TYPES = ['blind_draw', 'quota_nassau', 'birdie_pot']

export const SIDE_GAME_LABELS = {
  blind_draw: 'Blind Draw Partners',
  quota_nassau: 'Quota Nassau',
  birdie_pot: 'Birdie Pot'
}

export const SIDE_GAME_SHORT_LABELS = {
  blind_draw: 'Blind Draw',
  quota_nassau: 'Nassau',
  birdie_pot: 'Birdies'
}

export const SIDE_GAME_DESCRIPTIONS = {
  blind_draw: 'Partners are drawn at random after the round. The best combined +/- quota takes the pot. With an odd number, one team has three players and its total counts 2/3.',
  quota_nassau: 'Front 9, back 9 and overall on 18 holes (holes 1–3, 4–6, 7–9 and overall on 9), each against a prorated quota. Each bet is an equal share of the pot.',
  birdie_pot: 'A gross birdie earns 1 share and an eagle or better earns 2. The pot is split by shares.'
}

export const segmentLabel = (key) => {
  if (key === 'front') return 'Front 9'
  if (key === 'back') return 'Back 9'
  if (key === 'overall') return 'Overall'
  return `Holes ${String(key).replace('-', '–')}`
}

export const segmentOrder = (key) => {
  if (key === 'front') return 1
  if (key === 'back') return 10
  if (key === 'overall') return 100
  return parseInt(key, 10) || 0
}

export const formatSigned = (value) => {
  const n = Number(value) || 0
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2)
  return n > 0 ? `+${text}` : text
}

export const formatMoney = (value) =>
  `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
