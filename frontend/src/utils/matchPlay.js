// Display helpers for individual Nassau match play. The rules live on the server
// (src/utils/matchPlay.js).

const SEGMENTS = { front: 'Front 9', back: 'Back 9', overall: 'Overall' }

export const betLabel = (bet) =>
  bet.press ? `Press ${bet.press} (${bet.from}–${bet.to})` : SEGMENTS[bet.key]

// "Not started", "All square thru 4", "Ann 2 up thru 6", "Ann wins 3 & 2", "Ann wins 1 up", "Halved"
export const betStatus = (bet, names) => {
  const up = Math.abs(bet.lead)
  if (bet.winner === -1) return 'Halved'
  if (bet.winner !== null) {
    return `${names[bet.winner]} wins ${bet.remaining > 0 ? `${up} & ${bet.remaining}` : `${up} up`}`
  }
  if (bet.played === 0) return 'Not started'
  if (bet.lead === 0) return `All square thru ${bet.played}`
  return `${names[bet.lead > 0 ? 0 : 1]} ${up} up thru ${bet.played}`
}

export const dollars = (value) => {
  const n = Math.abs(Number(value) || 0)
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`
}

// Same difference the server uses, for the note under the handicap boxes.
export const strokesNote = (mine, theirs, theirName) => {
  if (mine === '' || theirs === '') return 'Enter both handicaps to see the strokes.'
  const difference = Number(mine) - Number(theirs)
  if (!Number.isFinite(difference)) return ''
  if (difference === 0) return 'Equal handicaps: no strokes.'
  const count = Math.abs(difference)
  const many = `${count} stroke${count === 1 ? '' : 's'}`
  return difference > 0 ? `You get ${many}, on the hardest holes.` : `${theirName} gets ${many}, on the hardest holes.`
}
