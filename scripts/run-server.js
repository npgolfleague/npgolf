/*
  scripts/run-server.js
  Helper to start the Node server and write logs into logs/ with a simple rotation.
  Usage: node scripts/run-server.js
  This is intended for local/dev usage to keep server logs organized.
*/
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const OUT = path.join(LOG_DIR, 'server.log');
const ERR = path.join(LOG_DIR, 'server.err');
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function rotateIfNeeded(file) {
  try {
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.size >= MAX_BYTES) {
        const backup = file + '.1';
        if (fs.existsSync(backup)) fs.unlinkSync(backup);
        fs.renameSync(file, backup);
      }
    }
  } catch (err) {
    console.error('Log rotation error', err);
  }
}

rotateIfNeeded(OUT);
rotateIfNeeded(ERR);

const outStream = fs.createWriteStream(OUT, { flags: 'a' });
const errStream = fs.createWriteStream(ERR, { flags: 'a' });

// spawn the server
const child = spawn(process.execPath, ['src/server.js'], {
  cwd: ROOT,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.on('data', chunk => outStream.write(chunk));
child.stderr.on('data', chunk => errStream.write(chunk));

child.on('close', code => {
  outStream.end();
  errStream.end();
  console.log(`Server process exited with code ${code}`);
});

console.log('Server started via scripts/run-server.js, logs in', LOG_DIR);
