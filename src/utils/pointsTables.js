// Cup points per place, kept separately for each league
// (league_settings.points_tables). A table lists 1st place, 2nd place and so
// on; its last value also goes to every place below.
const {
  REGULAR_SEASON_POINTS,
  PLAYOFF_SEED_POINTS,
  PLAYOFF_SEMIFINAL_POINTS,
  PLAYOFF_FINAL_POINTS,
  LOSERS_BRACKET_POINTS
} = require('./playoffs');

const DEFAULT_POINTS_TABLES = Object.freeze({
  weekly: REGULAR_SEASON_POINTS,
  seed: PLAYOFF_SEED_POINTS,
  semifinal: PLAYOFF_SEMIFINAL_POINTS,
  final: PLAYOFF_FINAL_POINTS,
  losers: LOSERS_BRACKET_POINTS
});
const LABELS = {
  weekly: 'Weekly points',
  seed: 'Semifinal seed points',
  semifinal: 'Semifinal round points',
  final: 'Final round points',
  losers: 'Losers bracket points'
};
const MAX_PLACES = 50;
const MAX_POINTS = 10000;

// What is wrong with one table, or null.
function tableError(name, table) {
  const label = LABELS[name];
  if (!Array.isArray(table) || table.length < 1 || table.length > MAX_PLACES) {
    return `${label}: list between 1 and ${MAX_PLACES} places`;
  }
  if (table.some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_POINTS)) {
    return `${label}: every value must be a whole number from 0 to ${MAX_POINTS}`;
  }
  if (table.some((v, i) => i > 0 && v > table[i - 1])) {
    return `${label}: a place cannot be worth more than the place above it`;
  }
  return null;
}

// Checks a full or partial set of tables sent by an admin.
function pointsTablesError(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'Invalid points tables';
  for (const name of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(LABELS, name)) return 'Unknown points table';
    const error = tableError(name, value[name]);
    if (error) return error;
  }
  return null;
}

// All five tables for a stored value; anything missing or unusable is the default.
function resolvePointsTables(stored) {
  let own = stored;
  if (typeof own === 'string') {
    try { own = JSON.parse(own); } catch (_err) { own = null; }
  }
  return Object.fromEntries(Object.entries(DEFAULT_POINTS_TABLES).map(([name, fallback]) => [
    name, own && !tableError(name, own[name]) ? [...own[name]] : [...fallback]
  ]));
}

module.exports = { DEFAULT_POINTS_TABLES, pointsTablesError, resolvePointsTables };
