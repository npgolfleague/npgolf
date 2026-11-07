// Scenario tests for the FedEx Cup playoff rules in src/utils/playoffs.js.
// Each test is one rule from the commissioner, written so a failure says
// which rule broke.
const {
  awardRegularSeasonPoints,
  computeSemifinal,
  awardFinalRoundPoints,
  pickChampion
} = require('../src/utils/playoffs');

const pointsById = (awards) => Object.fromEntries(awards.map((a) => [a.player_id, a.points_awarded]));
const rankById = (awards) => Object.fromEntries(awards.map((a) => [a.player_id, a.rank_position]));

// Builds players 1..n with the given over/under scores.
const playersWithScores = (scores) => scores.map((score, i) => ({
  player_id: i + 1,
  name: `Player ${String.fromCharCode(65 + i)}`,
  over_under: score
}));

describe('regular season weekly points', () => {
  test('two players tied for 1st share (100 + 90) / 2 = 95, next player is 3rd', () => {
    const awards = awardRegularSeasonPoints(playersWithScores([8, 8, 5]));
    expect(pointsById(awards)).toEqual({ 1: 95, 2: 95, 3: 80 });
    expect(rankById(awards)).toEqual({ 1: 1, 2: 1, 3: 3 });
  });

  test('places 1-10 get 100..10 and everyone below 10th gets 1', () => {
    const awards = awardRegularSeasonPoints(playersWithScores([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));
    expect(awards.map((a) => a.points_awarded)).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1, 1]);
  });

  test('fractional shares round up: tie for 10th/11th gives (10 + 1) / 2 = 5.5 -> 6', () => {
    const scores = [20, 19, 18, 17, 16, 15, 14, 13, 12, 5, 5];
    const awards = awardRegularSeasonPoints(playersWithScores(scores));
    expect(pointsById(awards)[10]).toBe(6);
    expect(pointsById(awards)[11]).toBe(6);
  });

  test('fractional shares round up: 3-way tie for 9th-11th gives 31 / 3 -> 11', () => {
    const scores = [20, 19, 18, 17, 16, 15, 14, 13, 4, 4, 4];
    const awards = awardRegularSeasonPoints(playersWithScores(scores));
    expect([pointsById(awards)[9], pointsById(awards)[10], pointsById(awards)[11]]).toEqual([11, 11, 11]);
  });

  test('names never decide points', () => {
    const players = [
      { player_id: 1, name: 'Zimmer', over_under: 4 },
      { player_id: 2, name: 'Adams', over_under: 4 }
    ];
    expect(pointsById(awardRegularSeasonPoints(players))).toEqual({ 1: 95, 2: 95 });
  });
});

// A season with 10 players. Regular points decide the 8 semifinal seeds.
const regularStandings = [
  { player_id: 1, name: 'Ann', regular_points: 900 },
  { player_id: 2, name: 'Bob', regular_points: 800 },
  { player_id: 3, name: 'Cal', regular_points: 700 },
  { player_id: 4, name: 'Dee', regular_points: 600 },
  { player_id: 5, name: 'Eve', regular_points: 500 },
  { player_id: 6, name: 'Fay', regular_points: 400 },
  { player_id: 7, name: 'Gus', regular_points: 300 },
  { player_id: 8, name: 'Hal', regular_points: 200 },
  { player_id: 9, name: 'Ivy', regular_points: 100 },
  { player_id: 10, name: 'Jon', regular_points: 50 }
];
const seededRoster = regularStandings.slice(0, 8).map(({ player_id, name }) => ({ player_id, name }));

describe('semifinal', () => {
  test('performance points use each player\'s real over/under (September bug: everyone got 65)', () => {
    // Hal (8th seed) has the best day, Ann (1st seed) the worst.
    const scores = seededRoster.map((p, i) => ({ ...p, over_under: i - 3 }));
    const result = computeSemifinal({ regularStandings, participants: seededRoster, scores });

    expect(result.error).toBeNull();
    const performance = pointsById(result.performanceAwards);
    expect(performance[8]).toBe(100);
    expect(performance[1]).toBe(30);
    expect(new Set(Object.values(performance)).size).toBe(8);
  });

  test('seed points follow regular-season rank: 100, 90 ... 30', () => {
    const scores = seededRoster.map((p) => ({ ...p, over_under: 0 }));
    const result = computeSemifinal({ regularStandings, participants: seededRoster, scores });
    expect(result.seedAwards.map((a) => a.points_awarded)).toEqual([100, 90, 80, 70, 60, 50, 40, 30]);
  });

  test('top 4 by seed + performance points advance to the final', () => {
    // Performance order matches seed order, so seeds 1-4 advance.
    const scores = seededRoster.map((p, i) => ({ ...p, over_under: 10 - i }));
    const result = computeSemifinal({ regularStandings, participants: seededRoster, scores });
    expect(result.finalists.map((f) => f.player_id).sort()).toEqual([1, 2, 3, 4]);
    expect(result.finalists.find((f) => f.player_id === 1).playoff_points).toBe(200);
  });

  test('everyone tied with 4th place also advances', () => {
    // Seeds 4 and 5 finish level on seed + performance points (70 + 60 = 60 + 70).
    const overUnder = { 1: 10, 2: 9, 3: 8, 4: 6, 5: 7, 6: 2, 7: 1, 8: 0 };
    const scores = seededRoster.map((p) => ({ ...p, over_under: overUnder[p.player_id] }));
    const result = computeSemifinal({ regularStandings, participants: seededRoster, scores });
    expect(result.finalists.map((f) => f.player_id).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('a tie for 8th in regular points seeds both players, sharing seed points', () => {
    const standings = regularStandings.map((p) => (p.player_id === 9 ? { ...p, regular_points: 200 } : p));
    const roster = standings.slice(0, 9).map(({ player_id, name }) => ({ player_id, name }));
    const scores = roster.map((p) => ({ ...p, over_under: 0 }));
    const result = computeSemifinal({ regularStandings: standings, participants: roster, scores });

    expect(result.seeded).toHaveLength(9);
    expect(pointsById(result.seedAwards)[8]).toBe(30);
    expect(pointsById(result.seedAwards)[9]).toBe(30);
  });

  test('non-finalists are ranked in the losers bracket on the day\'s over/under', () => {
    const scores = seededRoster.map((p, i) => ({ ...p, over_under: 10 - i }));
    const result = computeSemifinal({ regularStandings, participants: seededRoster, scores });
    expect(result.losersAwards.map((a) => [a.player_id, a.points_awarded])).toEqual([[5, 100], [6, 90], [7, 80], [8, 70]]);
  });

  test('without an override, a non-qualifier on the roster is rejected', () => {
    const roster = [...seededRoster, { player_id: 9, name: 'Ivy' }];
    const scores = roster.map((p) => ({ ...p, over_under: 0 }));
    const result = computeSemifinal({ regularStandings, participants: roster, scores });
    expect(result.error).toBe('roster_mismatch');
    expect(result.extra.map((p) => p.player_id)).toEqual([9]);
  });

  test('a qualifier missing from the roster is rejected', () => {
    const roster = seededRoster.filter((p) => p.player_id !== 3);
    const scores = roster.map((p) => ({ ...p, over_under: 0 }));
    const result = computeSemifinal({ regularStandings, participants: roster, scores });
    expect(result.error).toBe('roster_mismatch');
    expect(result.missing.map((p) => p.player_id)).toEqual([3]);
  });

  test('with an override, the admin list is the field and extra players go to the losers bracket', () => {
    const overrideIds = [1, 2, 3, 4, 5, 6, 7, 9];
    const roster = [...seededRoster, { player_id: 9, name: 'Ivy' }];
    const scores = roster.map((p, i) => ({ ...p, over_under: 10 - i }));
    const result = computeSemifinal({ regularStandings, participants: roster, scores, overrideIds });

    expect(result.error).toBeNull();
    expect(result.seeded.map((p) => p.player_id)).toEqual(overrideIds);
    expect(result.losersAwards.map((a) => a.player_id)).toContain(8);
  });
});

describe('final round points', () => {
  const finalists = [
    { player_id: 1, name: 'Ann', over_under: 6, regular_points: 900 },
    { player_id: 2, name: 'Bob', over_under: 4, regular_points: 800 },
    { player_id: 3, name: 'Cal', over_under: 2, regular_points: 700 },
    { player_id: 4, name: 'Dee', over_under: 0, regular_points: 600 }
  ];

  test('no ties: 200, 90, 80, 70', () => {
    const { awards, firstPlaceTie } = awardFinalRoundPoints(finalists);
    expect(pointsById(awards)).toEqual({ 1: 200, 2: 90, 3: 80, 4: 70 });
    expect(firstPlaceTie).toBeNull();
  });

  test('ties below 1st are shared: tie for 2nd gives (90 + 80) / 2 = 85', () => {
    const tied = finalists.map((p) => (p.player_id === 3 ? { ...p, over_under: 4 } : p));
    expect(pointsById(awardFinalRoundPoints(tied).awards)).toEqual({ 1: 200, 2: 85, 3: 85, 4: 70 });
  });

  test('tie for 1st goes to the player with more regular-season points; the other gets 2nd', () => {
    const tied = finalists.map((p) => (p.player_id === 2 ? { ...p, over_under: 6 } : p));
    const { awards, firstPlaceTie } = awardFinalRoundPoints(tied);
    expect(pointsById(awards)).toEqual({ 1: 200, 2: 90, 3: 80, 4: 70 });
    expect(firstPlaceTie).toMatchObject({ resolved: true, decidedBy: 'regular_points', winner_id: 1 });
  });

  test('3-way tie for 1st: winner gets 200, the other two share 2nd and 3rd', () => {
    const tied = finalists.map((p) => (p.player_id <= 3 ? { ...p, over_under: 6 } : p));
    expect(pointsById(awardFinalRoundPoints(tied).awards)).toEqual({ 1: 200, 2: 85, 3: 85, 4: 70 });
  });

  test('tie for 1st with equal regular points waits for the putt-off', () => {
    const tied = finalists.map((p) => (p.player_id <= 2 ? { ...p, over_under: 6, regular_points: 800 } : p));
    const { awards, firstPlaceTie } = awardFinalRoundPoints(tied);
    expect(firstPlaceTie.resolved).toBe(false);
    expect(firstPlaceTie.candidates.map((p) => p.player_id).sort()).toEqual([1, 2]);
    // Shared for now, until the putt-off is recorded.
    expect(pointsById(awards)[1]).toBe(145);
    expect(pointsById(awards)[2]).toBe(145);
  });

  test('the putt-off winner takes 1st place', () => {
    const tied = finalists.map((p) => (p.player_id <= 2 ? { ...p, over_under: 6, regular_points: 800 } : p));
    const { awards, firstPlaceTie } = awardFinalRoundPoints(tied, 2);
    expect(pointsById(awards)).toEqual({ 1: 90, 2: 200, 3: 80, 4: 70 });
    expect(firstPlaceTie).toMatchObject({ resolved: true, decidedBy: 'puttoff', winner_id: 2 });
  });
});

describe('champion', () => {
  test('most playoff points wins; regular-season points do not count', () => {
    const result = pickChampion([
      { player_id: 1, name: 'Ann', playoff_points: 380, regular_points: 2000 },
      { player_id: 2, name: 'Bob', playoff_points: 390, regular_points: 100 }
    ]);
    expect(result).toMatchObject({ championId: 2, decidedBy: 'playoff_points', needsTiebreak: false });
  });

  test('a tie on playoff points goes to more regular-season points', () => {
    const result = pickChampion([
      { player_id: 1, name: 'Ann', playoff_points: 390, regular_points: 500 },
      { player_id: 2, name: 'Bob', playoff_points: 390, regular_points: 600 }
    ]);
    expect(result).toMatchObject({ championId: 2, decidedBy: 'regular_points' });
  });

  test('still tied: wait for the putt-off, then the putt-off winner is champion', () => {
    const tied = [
      { player_id: 1, name: 'Ann', playoff_points: 390, regular_points: 500 },
      { player_id: 2, name: 'Bob', playoff_points: 390, regular_points: 500 },
      { player_id: 3, name: 'Cal', playoff_points: 200, regular_points: 900 }
    ];
    expect(pickChampion(tied)).toMatchObject({ championId: null, needsTiebreak: true });
    expect(pickChampion(tied).candidates.map((p) => p.player_id).sort()).toEqual([1, 2]);
    expect(pickChampion(tied, 1)).toMatchObject({ championId: 1, decidedBy: 'puttoff', needsTiebreak: false });
  });

  test('a putt-off winner who was not in the tie is ignored', () => {
    const tied = [
      { player_id: 1, name: 'Ann', playoff_points: 390, regular_points: 500 },
      { player_id: 2, name: 'Bob', playoff_points: 390, regular_points: 500 },
      { player_id: 3, name: 'Cal', playoff_points: 200, regular_points: 900 }
    ];
    expect(pickChampion(tied, 3)).toMatchObject({ championId: null, needsTiebreak: true });
  });
});

describe('whole playoff, semifinal to champion', () => {
  test('champion is decided by seed + semifinal + final points', () => {
    // Semifinal: performance follows seed order, so finalists are seeds 1-4
    // with 200, 180, 160, 140 playoff points.
    const semiScores = seededRoster.map((p, i) => ({ ...p, over_under: 10 - i }));
    const semifinal = computeSemifinal({ regularStandings, participants: seededRoster, scores: semiScores });
    const afterSemi = Object.fromEntries(semifinal.finalists.map((f) => [f.player_id, f.playoff_points]));
    expect(afterSemi).toEqual({ 1: 200, 2: 180, 3: 160, 4: 140 });

    // Final: Dee (4th seed) wins the day, Ann is last.
    const finalScores = semifinal.finalists.map((f) => ({
      ...f,
      over_under: { 1: 0, 2: 2, 3: 4, 4: 9 }[f.player_id]
    }));
    const { awards } = awardFinalRoundPoints(finalScores);
    const finalPoints = pointsById(awards);
    expect(finalPoints).toEqual({ 1: 70, 2: 80, 3: 90, 4: 200 });

    // Totals: Ann 270, Bob 260, Cal 250, Dee 340 -> Dee is champion even
    // though Ann had the most regular-season points.
    const standings = semifinal.finalists.map((f) => ({
      ...f,
      playoff_points: f.playoff_points + finalPoints[f.player_id]
    }));
    expect(pickChampion(standings).championId).toBe(4);
  });
});
