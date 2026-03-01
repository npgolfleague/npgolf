require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const coursesRouter = require('./routes/courses');
const tournamentsRouter = require('./routes/tournaments');
const tournamentPlayersRouter = require('./routes/tournament-players');
const scoresRouter = require('./routes/scores');
const leaderboardRouter = require('./routes/leaderboard');
const settingsRouter = require('./routes/settings');
const emailsRouter = require('./routes/emails');
const app = express();

const PORT = process.env.PORT || 3000;

// CORS middleware to allow frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Register API routes FIRST before static files
app.use('/api/players', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/tournaments', tournamentPlayersRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/emails', emailsRouter);

// Public pages for SMS compliance (Twilio verification)
app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NPGOLF</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; color: #1f2937; }
      h1, h2 { color: #111827; }
      .card { max-width: 840px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; }
      .actions { margin-top: 16px; }
      a { color: #2563eb; text-decoration: none; }
      a.button { display: inline-block; background: #10b981; color: white; padding: 10px 16px; border-radius: 6px; }
      a.button:hover { background: #059669; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>NPGOLF</h1>
      <p><strong>Business Address:</strong> 12302 Glenfield Ave, Tampa, FL 33626</p>
      <p>NPGOLF is a golf tournament management app used to coordinate events and communicate with members.</p>
      <div class="actions">
        <a class="button" href="/login">Login</a>
      </div>
      <h2>SMS Program</h2>
      <p>For SMS program details, see our <a href="/public/sms-compliance">SMS Compliance</a> page.</p>
      <p>Read our <a href="/public/privacy">Privacy Policy</a>.</p>
    </div>
  </body>
</html>`);
});

app.get('/public/sms-compliance', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NPGOLF SMS Compliance</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; color: #1f2937; }
      h1, h2 { color: #111827; }
      .card { max-width: 840px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>NPGOLF — SMS Program Information</h1>
      <p><strong>Business Name:</strong> NPGOLF</p>
      <p><strong>Business Address:</strong> 12302 Glenfield Ave, Tampa, FL 33626</p>
      <p><strong>Contact:</strong> support@npgolf.com</p>
      <h2>Messaging Purpose</h2>
      <p>We send SMS messages to members regarding tournament participation, schedules, and event updates.</p>
      <h2>Opt-In & Consent</h2>
      <p>Members opt in to SMS messaging through the NPGOLF application. When they register to create an account a SMS text message will be sent to their phone number. Users can opt in by clicking the link provided in the text message. Once they click this link they will then be included in SMS messaging for upcoming tournaments. Consent is required before messages are sent.</p>
      <h2>Opt-Out</h2>
      <p>Reply STOP at any time to opt out. Reply HELP for assistance.</p>
      <h2>Message Frequency</h2>
      <p>Message frequency varies based on tournament activity. Typically it will be one text per week. Possibly 2 if there is a cancellation of a tournament due to weather.</p>
      <h2>Terms & Privacy</h2>
      <p>See our <a href="/public/privacy">Privacy Policy</a>.</p>
    </div>
  </body>
</html>`);
});

app.get('/public/privacy', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NPGOLF Privacy Policy</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; color: #1f2937; }
      h1, h2 { color: #111827; }
      .card { max-width: 840px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>NPGOLF Privacy Policy</h1>
      <p>We collect only the information required to manage tournaments and communicate with members, including name, email, phone number, and participation status.</p>
      <h2>Use of Information</h2>
      <p>We use this information to manage tournaments and send relevant notifications, including SMS messages when a member has opted in.</p>
      <h2>Data Sharing</h2>
      <p>We do not sell your personal information. We may share limited data with service providers (such as SMS carriers) to deliver messages.</p>
      <h2>Contact</h2>
      <p>For privacy inquiries, contact support@npgolf.com.</p>
    </div>
  </body>
</html>`);
});

// Serve frontend static files AFTER API routes
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // For any non-API route, serve index.html (SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// If this file is run directly, start the server. This makes it safe to require
// the app in tests without starting a listener.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
  
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

module.exports = app;
