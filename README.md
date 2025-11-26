# npgolf

Node backend + MySQL scaffold for the npgolf project.

## What I added
- `package.json` — scripts and dependencies
- `src/server.js` — Express app entry
- `src/db.js` — MySQL pool (mysql2/promise)
- `src/routes/users.js` — example GET/POST /api/users
- `.env.example` — env vars template
- `schema.sql` — SQL to create `npgolf` database and `users` table

## Quick start
1. Copy `.env.example` to `.env` and fill in your database values.
2. Install node deps:

	(use PowerShell in the project root)

	npm install

3. Create the database and table using the provided `schema.sql` file. For example with the mysql CLI:

	mysql -u root -p < schema.sql

4. Start the server:

	npm run start

5. Endpoints

- GET  / => basic health message
- GET  /api/users => list users (up to 100)
- POST /api/users => create user { name, email }

## Notes & next steps
- This is a minimal scaffold. Next steps you might want:
  - Add authentication
  - Add migrations (e.g., with knex or sequelize)
  - Add tests and CI
  - Add a frontend (React/Vue) served from a separate folder or from this server

If you want, I can run npm install and start the server for you and verify the root route responds.

