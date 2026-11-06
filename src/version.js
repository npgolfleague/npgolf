// Version details for the running app.
// In Docker these come from build args stamped into the image (see Dockerfile,
// build-pi.ps1, build-local.ps1). When running straight from a checkout
// (npm start), they fall back to asking git.
const { execSync } = require('child_process');
const path = require('path');
const { version: packageVersion } = require('../package.json');

const startedAt = new Date().toISOString();

function fromGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    }).toString().trim() || null;
  } catch (_err) {
    return null;
  }
}

function fromEnv(name) {
  const value = process.env[name];
  return value && value !== 'unknown' ? value : null;
}

let cached = null;

function getVersionInfo() {
  if (!cached) {
    cached = {
      version: packageVersion,
      commit: fromEnv('GIT_COMMIT') || fromGit('rev-parse --short HEAD'),
      branch: fromEnv('GIT_BRANCH') || fromGit('rev-parse --abbrev-ref HEAD'),
      buildTime: fromEnv('BUILD_TIME'),
      startedAt
    };
  }
  return cached;
}

module.exports = { getVersionInfo };
