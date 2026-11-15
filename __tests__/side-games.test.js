// Scenario tests for the side-game rules in src/utils/sideGames.js.
// Each test is one rule, written so a failure says which rule broke.
const {
  drawBlindTeams,
  scoreBlindDraw,
  nassauSegments,
  scoreQuotaNassau,
  birdieShares,
  scoreBirdiePot,
  gamePot
} = require('../src/utils/sideGames');

// Deterministic "random" numbers for the draw.
const seededRng = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const prizeById = (rows, segment = 'overall') => Object.fromEntries(
  rows.filter((r) => r.segment === segment).map((r) => [r.player_id, r.prize_money])
);

describe('Blind Draw Partners', () => {
  test('an even field is drawn into pairs, every entrant exactly once', () => {
    const teams = drawBlindTeams([1, 2, 3, 4, 5, 6], seededRng(7));
    expect(teams).toHaveLength(3);
    teams.forEach((team) => expect(team.player_ids).toHaveLength(2));
    expect(teams.flatMap((t) => t.player_ids).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('an odd field has one team of three', () => {
    const teams = drawBlindTeams([1, 2, 3, 4, 5], seededRng(3));
    expect(teams.map((t) => t.player_ids.length).sort()).toEqual([2, 3]);
    expect(teams.flatMap((t) => t.player_ids).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('fewer than two entrants means no game', () => {
    expect(drawBlindTeams([9])).toEqual([]);
  });

  test('best combined over/under takes the pot, split between partners', () => {
    const teams = [{ team_no: 1, player_ids: [1, 2] }, { team_no: 2, player_ids: [3, 4] }];
    const rows = scoreBlindDraw(teams, { 1: 3, 2: -1, 3: 1, 4: 0 }, 20);
    expect(prizeById(rows)).toEqual({ 1: 10, 2: 10, 3: 0, 4: 0 });
  });

  test('a team of three is scaled by 2/3', () => {
    const teams = [{ team_no: 1, player_ids: [1, 2, 3] }, { team_no: 2, player_ids: [4, 5] }];
    // Team 1 raw +6 -> +4.00; team 2 raw +5. Team 2 wins.
    const rows = scoreBlindDraw(teams, { 1: 2, 2: 2, 3: 2, 4: 3, 5: 2 }, 25);
    expect(rows.find((r) => r.player_id === 1).score).toBe(4);
    expect(prizeById(rows)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 12, 5: 12 });
  });

  test('tied teams split the pot, rounded down to the dollar', () => {
    const teams = [
      { team_no: 1, player_ids: [1, 2] },
      { team_no: 2, player_ids: [3, 4] },
      { team_no: 3, player_ids: [5, 6] }
    ];
    const rows = scoreBlindDraw(teams, { 1: 2, 2: 0, 3: 1, 4: 1, 5: -3, 6: 0 }, 30);
    // 30 / 2 teams = 15 per team, 7.50 each -> 7.
    expect(prizeById(rows)).toEqual({ 1: 7, 2: 7, 3: 7, 4: 7, 5: 0, 6: 0 });
  });
});

describe('Quota Nassau', () => {
  test('18 holes: front, back and overall', () => {
    const segments = nassauSegments(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(segments.map((s) => s.key)).toEqual(['front', 'back', 'overall']);
    expect(segments[0].holes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(segments[1].holes).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  test('9 holes on the front: 1-3, 4-6, 7-9 and overall', () => {
    const segments = nassauSegments([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(segments.map((s) => s.key)).toEqual(['1-3', '4-6', '7-9', 'overall']);
  });

  test('9 holes on the back: 10-12, 13-15, 16-18 and overall', () => {
    const segments = nassauSegments([18, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(segments.map((s) => s.key)).toEqual(['10-12', '13-15', '16-18', 'overall']);
  });

  test('each part is scored against a prorated quota', () => {
    const segments = nassauSegments([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Player 1 quota 9 (3 per part) scores 2 a hole = 6 per part.
    const holeRows = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => ({ player_id: 1, hole_number: h, points: 2 }));
    const rows = scoreQuotaNassau(holeRows, { 1: 9 }, segments, 0);
    expect(rows.find((r) => r.segment === '1-3').score).toBe(3);
    expect(rows.find((r) => r.segment === 'overall').score).toBe(9);
  });

  test('each part is an equal share of the pot; a tied part is split', () => {
    const segments = nassauSegments([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const holes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    // Same quota. Player 1 wins 1-3, player 2 wins 4-6, they tie 7-9 and overall.
    const p1 = [4, 4, 4, 1, 1, 1, 2, 2, 2];
    const p2 = [1, 1, 1, 4, 4, 4, 2, 2, 2];
    const holeRows = [
      ...holes.map((h, i) => ({ player_id: 1, hole_number: h, points: p1[i] })),
      ...holes.map((h, i) => ({ player_id: 2, hole_number: h, points: p2[i] }))
    ];
    const rows = scoreQuotaNassau(holeRows, { 1: 18, 2: 18 }, segments, 40);
    // 40 / 4 parts = 10 a part.
    expect(prizeById(rows, '1-3')).toEqual({ 1: 10, 2: 0 });
    expect(prizeById(rows, '4-6')).toEqual({ 1: 0, 2: 10 });
    expect(prizeById(rows, '7-9')).toEqual({ 1: 5, 2: 5 });
    expect(prizeById(rows, 'overall')).toEqual({ 1: 5, 2: 5 });
  });
});

describe('Birdie Pot', () => {
  test('birdie is 1 share, eagle or better 2, an ace 2', () => {
    expect(birdieShares(3, 4)).toBe(1);
    expect(birdieShares(3, 5)).toBe(2);
    expect(birdieShares(2, 5)).toBe(2);
    expect(birdieShares(1, 3)).toBe(2);
    expect(birdieShares(4, 4)).toBe(0);
  });

  test('the pot is split by shares, rounded down', () => {
    const rows = scoreBirdiePot([
      { player_id: 1, score: 3, par: 4 },
      { player_id: 1, score: 3, par: 5 },
      { player_id: 2, score: 2, par: 3 },
      { player_id: 3, score: 5, par: 4 }
    ], 20);
    // 4 shares, $5 a share.
    expect(prizeById(rows)).toEqual({ 1: 15, 2: 5, 3: 0 });
    expect(rows.find((r) => r.player_id === 1).shares).toBe(3);
  });

  test('no birdies, nobody is paid', () => {
    const rows = scoreBirdiePot([{ player_id: 1, score: 4, par: 4 }, { player_id: 2, score: 6, par: 4 }], 12);
    expect(prizeById(rows)).toEqual({ 1: 0, 2: 0 });
  });

  test('uneven shares round down to the dollar', () => {
    const rows = scoreBirdiePot([
      { player_id: 1, score: 3, par: 4 },
      { player_id: 2, score: 3, par: 4 },
      { player_id: 3, score: 3, par: 4 }
    ], 10);
    expect(prizeById(rows)).toEqual({ 1: 3, 2: 3, 3: 3 });
  });
});

describe('Pot size', () => {
  test('uses the collected amount when set, otherwise paid entrants x fee', () => {
    expect(gamePot({ collected: 37, fee: 5, paidCount: 8 })).toBe(37);
    expect(gamePot({ collected: null, fee: 5, paidCount: 8 })).toBe(40);
  });
});
