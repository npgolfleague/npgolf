require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const coursesRouter = require('./routes/courses');
const tournamentsRouter = require('./routes/tournaments');
const tournamentPlayersRouter = require('./routes/tournament-players');
const foursomesRouter = require('./routes/foursomes');
const scoresRouter = require('./routes/scores');
const leaderboardRouter = require('./routes/leaderboard');
const settingsRouter = require('./routes/settings');
const leaguesRouter = require('./routes/leagues');
const leagueSelectRouter = require('./routes/league-select');
const emailsRouter = require('./routes/emails');
const cartTagsRouter = require('./routes/cart-tags');
const billingEntitiesRouter = require('./routes/billing-entities');
const { leagueAliasMiddleware } = require('./middleware/league');
const app = express();

const PORT = process.env.PORT || 3000;

// CORS middleware to allow frontend requests
app.use((req, res, next) => {
  const allowedOrigins = ['https://npgolf.net', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3002'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// League alias middleware - extracts league from URL path
// Supports: /paradise/api/tournaments, /paradise/tournaments, etc.
app.use(leagueAliasMiddleware);

// Register API routes FIRST before static files
app.use('/api/players', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/tournaments', tournamentPlayersRouter);
app.use('/api/tournaments', foursomesRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/league-select', leagueSelectRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/cart-tags', cartTagsRouter);
app.use('/api/billing-entities', billingEntitiesRouter);

// Public pages for SMS compliance (Twilio verification)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(503).send('Frontend not built yet');
});

app.get('/public/sms-compliance', (req, res) => {
  res.redirect('/sms-consent');
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
      <p>For privacy inquiries, contact commish@npgolf.net.</p>
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
