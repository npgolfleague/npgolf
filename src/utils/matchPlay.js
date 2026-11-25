// Individual Nassau match play rules. Pure functions, no database.
//
// Two players, three matches: front 9, back 9 and overall. Each hole goes to the
// lower score (net, with handicaps); equal scores halve it. Holes run in card
// order, also in a shotgun start, because the two players may start on different
// holes. Optional, when both players agree:
//   handicaps  the higher handicap gets the difference, one stroke a hole from
//              the hardest hole on that player's card down, then around again.
//   presses    when a player falls 2 down in the newest bet of a nine, a new bet
//              for that nine's amount covers its remaining holes. No overall press.
//   carry      a halved front 9 adds its amount to the back 9, and a halved back 9
//              adds its amount (with anything carried) to the overall. A halved
//              overall pays nothing. Presses don't carry.

// difference: strokes to give. holes: [{ hole, index }] for the receiver's card.
// Returns Map of hole -> strokes. Cards with repeated or missing indexes are ranked.
const allocateStrokes = (difference, holes) => {
  const ranked = [...holes].sort((x, y) => (x.index || 99) - (y.index || 99) || x.hole - y.hole);
  const count = ranked.length || 1;
  return new Map(ranked.map((h, i) => [h.hole, Math.floor(difference / count) + (i < difference % count ? 1 : 0)]));
};

// results: Map of hole -> 1 (side 0 won), -1 (side 1 won) or 0 (halved); holes
// not finished by both players are missing.
//   lead    holes up for side 0 (negative: side 1), frozen once decided
//   winner  0 or 1 once decided, -1 when halved, null while open
const playMatch = (holes, results) => {
  let lead = 0;
  let played = 0;
  for (const hole of holes) {
    if (!results.has(hole)) continue;
    played += 1;
    lead += results.get(hole);
    if (Math.abs(lead) > holes.length - played) break; // can't be caught
  }
  const remaining = holes.length - played;
  let winner = null;
  if (holes.length > 0 && Math.abs(lead) > remaining) winner = lead > 0 ? 0 : 1;
  else if (holes.length > 0 && remaining === 0) winner = -1;
  return { lead, played, remaining, winner };
};

// The presses started so far in one nine, as lists of holes. Follows the card up
// to the first hole not finished by both.
const findPresses = (holes, results) => {
  const presses = [];
  let newest = 0;
  for (let i = 0; i < holes.length - 1 && results.has(holes[i]); i++) {
    newest += results.get(holes[i]);
    if (Math.abs(newest) >= 2) {
      presses.push(holes.slice(i + 1));
      newest = 0;
    }
  }
  return presses;
};

// terms: { amounts: { front, back, overall }, autoPress, carryHalved }
// scores: [Map, Map] of hole -> strokes; strokes: [Map, Map] of hole -> strokes received.
// net is what side 0 is up (negative: down), from decided bets only.
const scoreNassauMatch = (holeNumbers, scores, strokes, terms) => {
  const holes = [...holeNumbers].sort((x, y) => x - y);
  const results = new Map();
  const detail = [];
  let running = 0;
  for (const hole of holes) {
    const gross = scores.map((s) => s.get(hole));
    const given = strokes.map((s) => s.get(hole) || 0);
    if (gross.some((g) => !(g > 0))) {
      detail.push({ hole, result: null, running: null, strokes: given });
      continue;
    }
    const diff = (gross[1] - given[1]) - (gross[0] - given[0]);
    const result = Math.sign(diff);
    results.set(hole, result);
    running += result;
    detail.push({ hole, result, running, strokes: given, scores: gross });
  }

  const amount = { ...terms.amounts };
  const segments = { front: holes.filter((h) => h <= 9), back: holes.filter((h) => h > 9), overall: holes };
  const bets = [];
  const add = (key, betHoles, value, press = 0) => {
    const bet = { key, press, from: betHoles[0], to: betHoles[betHoles.length - 1], amount: value, ...playMatch(betHoles, results) };
    bets.push(bet);
    return bet;
  };
  for (const key of ['front', 'back', 'overall']) {
    const bet = add(key, segments[key], amount[key]);
    if (terms.autoPress && key !== 'overall') {
      findPresses(segments[key], results).forEach((pressHoles, i) => add(key, pressHoles, terms.amounts[key], i + 1));
    }
    const next = { front: 'back', back: 'overall' }[key];
    if (terms.carryHalved && next && bet.winner === -1) amount[next] += amount[key];
  }

  const net = bets.reduce((sum, b) => sum + (b.winner === 0 ? b.amount : b.winner === 1 ? -b.amount : 0), 0);
  return { bets, holes: detail, net: Math.round(net * 100) / 100, decided: bets.every((b) => b.winner !== null) };
};

module.exports = { allocateStrokes, playMatch, findPresses, scoreNassauMatch };
