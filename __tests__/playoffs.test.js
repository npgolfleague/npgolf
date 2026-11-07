const {
  PLAYOFF_SEED_POINTS,
  PLAYOFF_FINAL_POINTS,
  LOSERS_BRACKET_POINTS,
  selectTopWithTies,
  awardRankedPoints,
  getPointsForRank
} = require('../src/utils/playoffs');

describe('playoff scoring helpers', () => {
  test('selectTopWithTies includes all players tied at the cutoff', () => {
    const players = [
      { player_id: 1, name: 'Alpha', over_under: 12 },
      { player_id: 2, name: 'Bravo', over_under: 10 },
      { player_id: 3, name: 'Charlie', over_under: 10 },
      { player_id: 4, name: 'Delta', over_under: 9 }
    ];

    const selected = selectTopWithTies(players, 2);

    expect(selected.map((player) => player.player_id)).toEqual([1, 2, 3]);
  });

  test('awards seed points with tie averaging at the cutoff', () => {
    const players = [
      { player_id: 1, name: 'Alpha', over_under: 20 },
      { player_id: 2, name: 'Bravo', over_under: 18 },
      { player_id: 3, name: 'Charlie', over_under: 18 },
      { player_id: 4, name: 'Delta', over_under: 12 },
      { player_id: 5, name: 'Echo', over_under: 11 }
    ];

    const awards = awardRankedPoints(players, PLAYOFF_SEED_POINTS);

    expect(awards[0].points_awarded).toBe(100);
    expect(awards[1].points_awarded).toBe(85);
    expect(awards[2].points_awarded).toBe(85);
    expect(awards[3].points_awarded).toBe(70);
    expect(awards[4].points_awarded).toBe(60);
  });

  test('uses the last slot value for cutoff ties beyond the table length', () => {
    expect(getPointsForRank(8, PLAYOFF_SEED_POINTS)).toBe(30);
    expect(getPointsForRank(9, PLAYOFF_SEED_POINTS)).toBe(30);
    expect(getPointsForRank(12, LOSERS_BRACKET_POINTS)).toBe(1);
  });

  test('finals points table keeps first-place bonus and averages ties', () => {
    const players = [
      { player_id: 1, name: 'Alpha', over_under: 14 },
      { player_id: 2, name: 'Bravo', over_under: 14 },
      { player_id: 3, name: 'Charlie', over_under: 9 }
    ];

    const awards = awardRankedPoints(players, PLAYOFF_FINAL_POINTS);

    expect(awards[0].points_awarded).toBe(145);
    expect(awards[1].points_awarded).toBe(145);
    expect(awards[2].points_awarded).toBe(80);
  });

  test('losers bracket points remain on the regular descending scale', () => {
    const players = [
      { player_id: 1, name: 'Alpha', over_under: 8 },
      { player_id: 2, name: 'Bravo', over_under: 7 },
      { player_id: 3, name: 'Charlie', over_under: 7 }
    ];

    const awards = awardRankedPoints(players, LOSERS_BRACKET_POINTS);

    expect(awards[0].points_awarded).toBe(100);
    expect(awards[1].points_awarded).toBe(85);
    expect(awards[2].points_awarded).toBe(85);
  });
});