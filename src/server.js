require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const coursesRouter = require('./routes/courses');
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

app.use(express.json());

// Serve frontend static files when present (built assets)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // For any non-API route, serve index.html (SPA)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.get('/', (req, res) => {
  res.json({ message: 'npgolf API - Node + MySQL backend' });
});

app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);

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
