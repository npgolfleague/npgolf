# npgolf

Node backend + MySQL scaffold for the npgolf project.

## What I added
- `package.json` — scripts and dependencies
- `src/server.js` — Express app entry
- `src/db.js` — MySQL pool (mysql2/promise)
- `src/routes/users.js` — example GET/POST /api/users
- `.env.example` — env vars template
- `schema.sql` — SQL to create `npgolf` database and `users` table

## Quick start (local development)

1. Copy `.env.example` to `.env` and adjust values. For local development (docker-compose) the project uses:

	- DB_USER=root
	- DB_PASS=root
	- DB_NAME=npgolf

	If you prefer to run as the dedicated app user (recommended), update `.env` after running migrations (see below):

	- DB_USER=npgolf_app
	- DB_PASS=app_password

2. Install node deps (PowerShell):

	npm install

3. Start a local MySQL instance using Docker (recommended):

	docker-compose up -d

	The compose file seeds the `npgolf` database using `schema.sql` on first run.

4. Run migrations (needs a privileged account, e.g. root) to create the dedicated DB user and other schema changes:

	npm run migrate

	This will run the SQL files in `migrations/` in sorted order. The migration `003_create_app_user.sql` creates a `npgolf_app` user and grants limited privileges.

### Create a randomized app user (convenience)

If you prefer not to use the example static password, you can generate a randomized password and write it to `.env.local` with the helper script. The script uses the DB credentials found in your current `.env` (root user required to create the app user):

```powershell
npm run create-app-user
```

After the script runs it will write `.env.local` containing `DB_USER=npgolf_app` and `DB_PASS=<random password>`. Copy these values into your `.env` or use `.env.local` for local runs.


5. (Optional) Run seeds to populate initial data:

	npm run seed

6. Start the server

	- To run normally (no redirection):

	  npm run start

	- To run and write logs into `./logs/` with simple rotation:

	  npm run start:logs

7. Endpoints

- GET  / => basic health message
- GET  /api/users => list users (up to 100)
- POST /api/users => create user { name, email, password? }

Notes on credentials and security

- The migration creates a local user `npgolf_app` with password `app_password` for convenience. In production you should:
  - Create a dedicated DB user with a strong password and limited privileges.
  - Do not store secrets in the repository — keep `.env` out of version control.

Troubleshooting

- If you see `ER_ACCESS_DENIED_ERROR` when running the app, ensure `.env` matches the DB credentials (for docker-compose the root password is `root`).

## Frontend (development & production)

The frontend is a separate Vite + React app in the `frontend/` folder.

1. Install dependencies and run the dev server (hot reload):

```powershell
cd frontend
npm install
npm run dev
```

The dev server will show a local URL (usually http://localhost:3001). The frontend expects the backend API at the URL configured via `import.meta.env.VITE_API_URL` or the Vite proxy if configured. You can open the browser and use the UI to register/login.

2. Build and preview a production bundle:

```powershell
cd frontend
npm run build
npm run preview
```

Preview serves the built assets locally so you can test the production build.



## Notes & next steps
- This is a minimal scaffold. Next steps you might want:
  - Add authentication
  - Add migrations (e.g., with knex or sequelize)
  - Add tests and CI
  - Add a frontend (React/Vue) served from a separate folder or from this server

If you want, I can run npm install and start the server for you and verify the root route responds.

