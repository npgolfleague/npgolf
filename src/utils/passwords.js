// Password rules and hashing, used everywhere a password is set.
const bcrypt = require('bcryptjs');

const MIN_LENGTH = 10;
const MAX_BYTES = 72; // bcrypt ignores anything after this
const MIN_COST = 12;

// Words people build passwords from. A password that is just one of these with
// numbers or symbols around it (Password2026!, g0lf12345) is refused.
const COMMON = new Set(`password passwort passw passwd pass admin administrator welcome letmein login master secret
  qwerty qwertyuiop qwertyui asdfgh asdfghjkl zxcvbn zxcvbnm qazwsx qwer asdf abc abcd abcde abcdef abcdefg abcdefgh
  iloveyou loveyou love lovely sunshine princess monkey dragon shadow superman batman spiderman pokemon starwars
  football baseball basketball soccer hockey tennis golf golfer golfing npgolf paradise paradisegolf paradisecup
  birdie eagle bogey albatross fairway holeinone league commish masters tiger tigerwoods
  jesus angel michael jordan ashley jennifer jessica charlie robert thomas daniel andrew matthew hunter summer
  winter spring autumn freedom whatever trustno trustnoone hello world helloworld computer internet
  google facebook test testing tester changeme default guest user temp temporary access cheese cookie
  florida tampa odessa america liberty killer ginger pepper buster harley ranger corvette mustang ferrari mercedes
  flower purple orange yellow banana chocolate diamond silver golden eagles buccaneers bucs lightning yankees cowboys`.split(/\s+/));

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const unleet = (text) => text.replace(/[013457@$!]/g, (c) => LEET[c]);
const trimEnds = (text) => text.replace(/^[^a-z]+|[^a-z]+$/g, '');
const lettersOnly = (text) => text.replace(/[^a-z]/g, '');

const isCommon = (password) => {
  const lower = password.toLowerCase();
  // With the ends trimmed first (Password123) and with swaps undone (p4ssw0rd).
  const bases = [trimEnds(lower), lettersOnly(lower), lettersOnly(unleet(trimEnds(lower))), lettersOnly(unleet(lower.replace(/[^a-z@$]+$/, '')))];
  return bases.some((base) => base === '' || COMMON.has(base)
    || (base.length % 2 === 0 && base.slice(0, base.length / 2) === base.slice(base.length / 2) && COMMON.has(base.slice(0, base.length / 2))));
};

// Mostly one run along the keyboard or alphabet, in either direction.
const isSequence = (password) => {
  const lower = password.toLowerCase();
  return SEQUENCES.some((seq) => [seq, [...seq].reverse().join('')].some((s) => {
    for (let len = Math.min(s.length, lower.length); len >= 6 && len >= lower.length * 0.6; len -= 1) {
      for (let i = 0; i + len <= s.length; i += 1) if (lower.includes(s.slice(i, i + len))) return true;
    }
    return false;
  }));
};

// Why a password can't be used, or null when it can.
const passwordProblem = (password, { name = '', email = '' } = {}) => {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (Buffer.byteLength(password) > MAX_BYTES) return 'Password is too long';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must include a letter and a number';
  if (new Set(password.toLowerCase()).size < 5 || isCommon(password) || isSequence(password)) {
    return 'That password is too easy to guess. Try a few unrelated words and a number';
  }
  const lower = password.toLowerCase();
  const parts = [...String(name).toLowerCase().split(/[^\p{L}]+/u), String(email).toLowerCase().split('@')[0]];
  if (parts.some((part) => part.length >= 4 && lower.includes(part))) return 'Password must not contain your name or email';
  return null;
};

// Tests may use a cheap cost; everywhere else it is at least MIN_COST.
const cost = () => {
  const configured = Number(process.env.BCRYPT_ROUNDS) || MIN_COST;
  return process.env.NODE_ENV === 'test' ? configured : Math.max(MIN_COST, configured);
};

const hashPassword = (password) => bcrypt.hash(password, cost());
const needsRehash = (hash) => bcrypt.getRounds(hash) < cost();

module.exports = { MIN_LENGTH, passwordProblem, hashPassword, needsRehash };
