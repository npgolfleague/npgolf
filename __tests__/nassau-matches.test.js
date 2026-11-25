// Individual Nassau match play: the rules, and who may do and see what.
const request = require('supertest');

let mockUser;
let mockAdmin;
jest.mock('../src/middleware/admin', () => {
  class AuthError extends Error {}
  const pass = (req, _res, next) => { req.user = mockUser; next(); };
  return { requireAdmin: pass, requireSuperAdmin: pass, requireAnyAdmin: pass, requireAuth: pass, AuthError,
    assertLeagueAdmin: async () => { if (!mockAdmin) throw new AuthError('no'); },
    assertTournamentAccess: async () => {}, isAdminCapableRole: () => false, isSuperAdminRole: () => false };
});
jest.mock('../src/middleware/league', () => ({ leagueAliasMiddleware: (_req, _res, next) => next() }));
jest.mock('../src/middleware/season', () => {
  const pass = (_req, _res, next) => next();
  return { requireOpenSeason: pass, requireOpenSeasonForScores: pass, requireOpenSeasonForScore: pass };
});
jest.mock('../src/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const app = require('../src/server');
const { allocateStrokes, scoreNassauMatch } = require('../src/utils/matchPlay');

const ALL = Array.from({ length: 18 }, (_, i) => i + 1);
// 'a' = side 0 wins the hole, 'b' = side 1, '-' = halved, '.' = not finished by both
const cards = (text) => {
  const out = [new Map(), new Map()];
  [...text.replace(/ /g, '')].forEach((mark, i) => {
    out[0].set(i + 1, mark === 'b' ? 5 : 4);
    if (mark !== '.') out[1].set(i + 1, mark === 'a' ? 5 : 4);
  });
  return out;
};
const play = (text, terms = {}, strokes = [new Map(), new Map()]) =>
  scoreNassauMatch(ALL, cards(text), strokes, { amounts: { front: 5, back: 6, overall: 10 }, ...terms });
const bet = (result, key, press = 0) => result.bets.find((b) => b.key === key && b.press === press);

describe('rules', () => {
  test('three matches, each for its own amount', () => {
    const r = play('a-------- bb-------');
    expect(bet(r, 'front')).toMatchObject({ winner: 0, lead: 1, remaining: 0 });
    expect(bet(r, 'back')).toMatchObject({ winner: 1, lead: -2, remaining: 1 });
    expect(bet(r, 'overall')).toMatchObject({ winner: 1, lead: -1, remaining: 0 });
    expect(r).toMatchObject({ net: 5 - 6 - 10, decided: true });
  });

  test('only holes finished by both count, and open matches pay nothing', () => {
    const r = play('aa.');
    expect(bet(r, 'front')).toMatchObject({ lead: 2, played: 2, winner: null });
    expect(r.net).toBe(0);
    expect(r.holes[2]).toMatchObject({ result: null });
    expect(r.holes[2].scores).toBeUndefined();
  });

  test('a match ends when it cannot be caught', () => {
    expect(bet(play('aaa-a-bbb'), 'front')).toMatchObject({ winner: 0, lead: 4, remaining: 3 });
    expect(bet(play('aa-----'), 'front').winner).toBeNull();
  });

  test('strokes go to the hardest holes first, then around again', () => {
    const card = ALL.map((hole) => ({ hole, index: 19 - hole }));
    expect([...allocateStrokes(2, card)].filter(([, n]) => n)).toEqual([[18, 1], [17, 1]]);
    expect(allocateStrokes(20, card).get(18)).toBe(2);
    expect(allocateStrokes(20, card).get(1)).toBe(1);
    const repeated = ALL.map((hole) => ({ hole, index: 1 }));
    expect([...allocateStrokes(3, repeated).values()].reduce((a, b) => a + b)).toBe(3);
  });

  test('a stroke turns a lost hole into a half and a half into a win', () => {
    const r = play('a-', {}, [new Map(), new Map([[1, 1], [2, 1]])]);
    expect(r.holes.slice(0, 2).map((h) => h.result)).toEqual([0, -1]);
  });

  test('presses start when 2 down, on the rest of that nine, and can be pressed again', () => {
    const r = play('aa-bb----', { autoPress: true });
    expect(r.bets.filter((b) => b.press).map((b) => [b.key, b.from, b.to])).toEqual([['front', 3, 9], ['front', 6, 9]]);
    expect(bet(r, 'front', 1)).toMatchObject({ winner: 1, amount: 5 });
    expect(bet(r, 'front', 2).winner).toBe(-1);
    expect(r.net).toBe(-5);
  });

  test('no press without the flag, on the overall, after the last hole, or past an unfinished hole', () => {
    expect(play('aa').bets).toHaveLength(3);
    expect(play('a-------a', { autoPress: true }).bets).toHaveLength(3);
    expect(play('a.a', { autoPress: true }).bets).toHaveLength(3);
    expect(play('a-------- a', { autoPress: true }).bets).toHaveLength(3);
  });

  test('halved matches carry to the next one only when chosen', () => {
    expect(play('--------- a--------').net).toBe(6 + 10);
    const front = play('--------- a--------', { carryHalved: true });
    expect(bet(front, 'back').amount).toBe(11);
    expect(front.net).toBe(11 + 10);
    const both = play('--------- ---------', { carryHalved: true });
    expect(bet(both, 'overall').amount).toBe(21);
    expect(both).toMatchObject({ net: 0, decided: true });
  });
});

describe('API', () => {
  let round; let match; let started; let entered; let scores;
  const URL = '/api/tournaments/7/nassau-matches';
  const terms = { opponent_id: 2, amount_front: 5, amount_back: '6', amount_overall: 10 };
  beforeEach(() => {
    mockUser = { id: 1 }; mockAdmin = false;
    round = { id: 7, course_id: 3, number_of_holes: 18, completed: 0 };
    started = false; entered = [1, 2]; scores = [];
    match = { id: 9, tournament_id: 7, player_a: 1, player_b: 2, name_a: 'Ann', name_b: 'Bob', amount_front: '5.00', amount_back: '6.00', amount_overall: '10.00', use_handicaps: 0, handicap_a: null, handicap_b: null, auto_press: 0, carry_halved: 0, status: 'pending' };
    pool.query.mockReset().mockImplementation(async (sql) => {
      if (/FROM tournament t WHERE/.test(sql)) return [round ? [round] : []];
      if (/SELECT 1 FROM scores/.test(sql)) return [started ? [{ 1: 1 }] : []];
      if (/FROM tournament_players/.test(sql)) return [entered.map((player_id) => ({ player_id }))];
      if (/SELECT m\.\*/.test(sql)) return [[match]];
      if (/SELECT \* FROM nassau_matches/.test(sql)) return [match ? [match] : []];
      if (/SELECT s\.player_id/.test(sql)) return [scores];
      return [{ affectedRows: 1, insertId: 9 }];
    });
  });
  const wrote = (re) => pool.query.mock.calls.filter(([sql]) => re.test(sql));

  test('a challenge is saved as the proposer, with only the agreed terms', async () => {
    await request(app).post(URL).send({ ...terms, status: 'accepted', player_a: 5, auto_press: true, handicap_a: 9 }).expect(201);
    const [[, [row]]] = wrote(/INSERT INTO nassau/);
    expect(row).toEqual({ tournament_id: 7, player_a: 1, player_b: 2, pair_low: 1, pair_high: 2, amount_front: 5, amount_back: 6, amount_overall: 10,
      use_handicaps: 0, handicap_a: null, handicap_b: null, auto_press: 1, carry_halved: 0 });
  });

  test.each([
    ['yourself', { opponent_id: 1 }], ['no opponent', { opponent_id: '' }], ['a negative amount', { amount_front: -1 }],
    ['a missing amount', { amount_back: '' }], ['missing handicaps', { use_handicaps: true, handicap_a: 4, handicap_b: '' }],
    ['a part handicap', { use_handicaps: true, handicap_a: 4.5, handicap_b: 2 }]
  ])('refuses %s', async (_l, over) => {
    await request(app).post(URL).send({ ...terms, ...over }).expect(400);
    expect(wrote(/INSERT/)).toHaveLength(0);
  });

  test('refuses a 9-hole round, a player not in it, and a match after the first score', async () => {
    started = true;
    await request(app).post(URL).send(terms).expect(409);
    started = false; entered = [1];
    await request(app).post(URL).send(terms).expect(400);
    entered = [1, 2]; round.number_of_holes = 9;
    await request(app).post(URL).send(terms).expect(400);
    expect(wrote(/INSERT/)).toHaveLength(0);
  });

  test('only the challenged player can accept, and not after the first score', async () => {
    await request(app).post(`${URL}/9/accept`).expect(403);
    mockAdmin = true;
    await request(app).post(`${URL}/9/accept`).expect(403);
    mockUser = { id: 2 }; started = true;
    await request(app).post(`${URL}/9/accept`).expect(409);
    expect(wrote(/UPDATE nassau/)).toHaveLength(0);
    started = false;
    await request(app).post(`${URL}/9/accept`).expect(200);
    expect(wrote(/UPDATE nassau/)[0][1]).toEqual(['accepted', 'accepted', 9]);
  });

  test('an accepted match cannot be dropped once play starts, except by an admin', async () => {
    match.status = 'accepted'; started = true;
    await request(app).delete(`${URL}/9`).expect(409);
    mockUser = { id: 3 };
    await request(app).delete(`${URL}/9`).expect(403);
    expect(wrote(/DELETE/)).toHaveLength(0);
    mockAdmin = true;
    await request(app).delete(`${URL}/9`).expect(200);
  });

  describe('what each person sees', () => {
    beforeEach(() => {
      match.status = 'accepted';
      scores = [{ player_id: 1, hole_number: 1, score: 4 }, { player_id: 2, hole_number: 1, score: 5 }, { player_id: 2, hole_number: 2, score: 3 }];
    });
    const view = async () => (await request(app).get(URL).expect(200)).body.matches[0];

    test('the players see amounts, and scores on holes both have finished', async () => {
      const m = await view();
      expect(m).toMatchObject({ mine: true, net: 0, amounts: { front: 5, back: 6, overall: 10 } });
      expect(m.holes[0]).toMatchObject({ result: 1, scores: [4, 5] });
      expect(m.holes[1]).toMatchObject({ result: null, scores: null });
    });

    test('everyone else, admins included, sees results without scores, amounts or handicaps', async () => {
      mockUser = { id: 3 }; mockAdmin = true;
      const m = await view();
      expect(m.bets[0]).toMatchObject({ key: 'front', lead: 1, played: 1 });
      expect(JSON.stringify(m)).not.toMatch(/"scores"|"amounts?"|"net"|"handicaps"/);
    });

    test('matches not accepted are asked for only as your own', async () => {
      await view();
      expect(wrote(/SELECT m\.\*/)[0][0]).toMatch(/m\.status = 'accepted' OR m\.player_a = \? OR m\.player_b = \?/);
    });

    test('a challenge not answered before play is off', async () => {
      match.status = 'pending';
      expect((await view()).status).toBe('expired');
    });
  });
});
