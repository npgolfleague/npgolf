// Side-game scoring rules. Pure functions, no database.
//
// Every side game is worked out from the scores players already enter, so the
// quota game, skins and CTP are not affected. Money is rounded down to the
// dollar, like the quota, skins and CTP pots.
//
//   blind_draw    Random partners drawn after the round. A team scores the sum
//                 of its members' over/under (quota points minus quota). With
//                 an odd number of entrants one team has three players and its
//                 total is multiplied by 2/3. Best team takes the pot; tied
//                 teams split it.
//   quota_nassau  Separate bets on parts of the round, each against a prorated
//                 quota (quota x holes in the part / holes played).
//                 18 holes: front 9, back 9, overall (1/3 of the pot each).
//                 9 holes: three 3-hole parts + overall (1/4 of the pot each).
//                 Best score in each part takes that share; ties split it.
//   birdie_pot    Gross birdie = 1 share, eagle or better (or an ace) = 2.
//                 The pot is split by shares. No birdies, no payout.

const GAME_TYPES = ['blind_draw', 'quota_nassau', 'birdie_pot'];

const GAME_LABELS = {
  blind_draw: 'Blind Draw Partners',
  quota_nassau: 'Quota Nassau',
  birdie_pot: 'Birdie Pot'
};

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const floorDollars = (value) => Math.max(0, Math.floor(Number(value) + 1e-9));

// Random pairs; with an odd count the leftover joins a random team.
// Fewer than two entrants means there is no game.
const drawBlindTeams = (playerIds, rng = Math.random) => {
  const ids = [...new Set(playerIds.map(Number))];
  if (ids.length < 2) return [];

  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const teams = [];
  for (let i = 0; i + 1 < ids.length; i += 2) {
    teams.push([ids[i], ids[i + 1]]);
  }
  if (ids.length % 2 === 1) {
    const leftover = ids[ids.length - 1];
    teams[Math.floor(rng() * teams.length)].push(leftover);
  }

  return teams.map((playerIdsOnTeam, index) => ({ team_no: index + 1, player_ids: playerIdsOnTeam }));
};

// teams: [{ team_no, player_ids }]; overUnderById: Map or object of player_id -> over/under.
// Returns one row per team member.
const scoreBlindDraw = (teams, overUnderById, pot) => {
  const lookup = (id) => Number(overUnderById instanceof Map ? overUnderById.get(id) : overUnderById[id]) || 0;

  const scored = teams.map((team) => {
    const raw = team.player_ids.reduce((sum, id) => sum + lookup(id), 0);
    const scale = team.player_ids.length > 2 ? 2 / team.player_ids.length : 1;
    return { ...team, score: round2(raw * scale) };
  });
  if (scored.length === 0) return [];

  const best = Math.max(...scored.map((team) => team.score));
  const winners = scored.filter((team) => team.score === best);
  const perWinningTeam = (Number(pot) || 0) / winners.length;

  return scored.flatMap((team) => {
    const isWinner = team.score === best;
    const perPlayer = isWinner ? floorDollars(perWinningTeam / team.player_ids.length) : 0;
    return team.player_ids.map((playerId) => ({
      segment: 'overall',
      player_id: playerId,
      team_no: team.team_no,
      score: team.score,
      shares: null,
      is_winner: isWinner,
      prize_money: perPlayer
    }));
  });
};

// The parts of the round, from the hole numbers actually played.
// 10+ holes: front half, back half, overall. Otherwise: thirds + overall.
const nassauSegments = (holeNumbers) => {
  const holes = [...new Set(holeNumbers.map(Number))].sort((a, b) => a - b);
  if (holes.length === 0) return [];

  const chunk = (list, parts) => {
    const size = Math.ceil(list.length / parts);
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  };

  const halves = holes.length >= 10;
  const segments = chunk(holes, halves ? 2 : 3).map((piece, index) => ({
    key: halves ? ['front', 'back'][index] : `${piece[0]}-${piece[piece.length - 1]}`,
    holes: piece
  }));
  segments.push({ key: 'overall', holes });
  return segments;
};

// holeRows: [{ player_id, hole_number, points }] for entrants only.
// quotaById: Map or object of player_id -> quota for the whole round.
const scoreQuotaNassau = (holeRows, quotaById, segments, pot) => {
  if (segments.length === 0) return [];
  const lookup = (id) => Number(quotaById instanceof Map ? quotaById.get(id) : quotaById[id]) || 0;

  const playerIds = [...new Set(holeRows.map((row) => Number(row.player_id)))];
  if (playerIds.length === 0) return [];

  const overall = segments.find((segment) => segment.key === 'overall') || segments[segments.length - 1];
  const totalHoles = overall.holes.length;
  const sharePerSegment = (Number(pot) || 0) / segments.length;

  return segments.flatMap((segment) => {
    const inSegment = new Set(segment.holes);
    const fraction = segment.holes.length / totalHoles;

    const scores = playerIds.map((playerId) => {
      const points = holeRows
        .filter((row) => Number(row.player_id) === playerId && inSegment.has(Number(row.hole_number)))
        .reduce((sum, row) => sum + (Number(row.points) || 0), 0);
      return { player_id: playerId, score: round2(points - lookup(playerId) * fraction) };
    });

    const best = Math.max(...scores.map((entry) => entry.score));
    const winnerCount = scores.filter((entry) => entry.score === best).length;
    const prize = floorDollars(sharePerSegment / winnerCount);

    return scores.map((entry) => ({
      segment: segment.key,
      player_id: entry.player_id,
      team_no: null,
      score: entry.score,
      shares: null,
      is_winner: entry.score === best,
      prize_money: entry.score === best ? prize : 0
    }));
  });
};

const birdieShares = (score, par) => {
  const strokes = Number(score);
  const diff = strokes - Number(par);
  if (strokes === 1 || diff <= -2) return 2;
  if (diff === -1) return 1;
  return 0;
};

// holeRows: [{ player_id, score, par }] for entrants only (every entrant
// appears at least once, so non-winners still get a row).
const scoreBirdiePot = (holeRows, pot) => {
  const sharesById = new Map();
  for (const row of holeRows) {
    const playerId = Number(row.player_id);
    const add = row.par == null ? 0 : birdieShares(row.score, row.par);
    sharesById.set(playerId, (sharesById.get(playerId) || 0) + add);
  }

  const totalShares = [...sharesById.values()].reduce((sum, shares) => sum + shares, 0);
  const perShare = totalShares > 0 ? (Number(pot) || 0) / totalShares : 0;

  return [...sharesById.entries()].map(([playerId, shares]) => ({
    segment: 'overall',
    player_id: playerId,
    team_no: null,
    score: null,
    shares,
    is_winner: shares > 0,
    prize_money: shares > 0 ? floorDollars(perShare * shares) : 0
  }));
};

const segmentLabel = (key) => {
  if (key === 'front') return 'Front 9';
  if (key === 'back') return 'Back 9';
  if (key === 'overall') return 'Overall';
  return `Holes ${String(key).replace('-', '–')}`;
};

// Sort key for segments: in hole order, overall last.
const segmentOrder = (key) => {
  if (key === 'front') return 1;
  if (key === 'back') return 10;
  if (key === 'overall') return 100;
  return parseInt(key, 10) || 0;
};

// Teams from result rows (Blind Draw), best first.
const blindDrawTeamsFromResults = (results) => {
  const byTeam = new Map();
  for (const r of results.filter((row) => row.game_type === 'blind_draw')) {
    if (!byTeam.has(r.team_no)) {
      byTeam.set(r.team_no, { team_no: r.team_no, score: r.score, is_winner: r.is_winner, prize_each: r.prize_money, players: [] });
    }
    byTeam.get(r.team_no).players.push(r.name);
  }
  return [...byTeam.values()].sort((a, b) => b.score - a.score || a.team_no - b.team_no);
};

// A game's pot: the amount collected when set, otherwise paid entrants x fee.
const gamePot = ({ collected, fee, paidCount }) => (
  collected != null && collected !== ''
    ? Number(collected) || 0
    : (Number(paidCount) || 0) * (Number(fee) || 0)
);

module.exports = {
  GAME_TYPES,
  GAME_LABELS,
  drawBlindTeams,
  scoreBlindDraw,
  nassauSegments,
  scoreQuotaNassau,
  birdieShares,
  scoreBirdiePot,
  segmentLabel,
  segmentOrder,
  blindDrawTeamsFromResults,
  gamePot
};
