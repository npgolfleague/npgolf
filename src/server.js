require('dotenv').config();
const express = require('express');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'npgolf API - Node + MySQL backend' });
});

app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);

// If this file is run directly, start the server. This makes it safe to require
// the app in tests without starting a listener.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
