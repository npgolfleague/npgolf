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

	- DB_PASS=app_password

2. Install node deps (PowerShell):

	npm install

3. Start a local MySQL instance using Docker (recommended):


	The compose file seeds the `npgolf` database using `schema.sql` on first run.

4. Run migrations (needs a privileged account, e.g. root) to create the dedicated DB user and other schema changes:

	npm run migrate


### Create a randomized app user (convenience)

If you prefer not to use the example static password, you can generate a randomized password and write it to `.env.local` with the helper script. The script uses the DB credentials found in your current `.env` (root user required to create the app user):

```powershell
```

After the script runs it will write `.env.local` containing `DB_USER=npgolf_app` and `DB_PASS=<random password>`. Copy these values into your `.env` or use `.env.local` for local runs.


5. (Optional) Run seeds to populate initial data:


6. Start the server

	- To run normally (no redirection):

	  npm run start

	- To run and write logs into `./logs/` with simple rotation:
	  npm run start:logs

## Shutdown & cleanup

Quick commands to stop dev servers, Docker containers, and clean up images/tarballs (PowerShell).

- Stop the frontend dev server (in the terminal where it is running):
# Press Ctrl+C in the terminal where `npm run dev` is running

	## Running the combined (multi-stage) container

	The repository supports a multi-stage Docker image that builds the frontend and serves it from the Express backend (single container). Use this for a lightweight production-style run.

	### 1. Build the image (if not already built)

	```powershell
	docker build -t npgolf-multi:latest .
	```

	### 2. Ensure MySQL is running

	If you started MySQL with docker compose earlier:

	```powershell
	docker compose up -d
	```

	This creates (by default) a network named `npgolf_default`. The app container must join that network to reach MySQL by service name.

	### 3. Run the container (root DB user)

	Either pass individual environment variables:

	```powershell
	docker run -d --name npgolf --network npgolf_default -p 3000:3000 \
		-e DB_HOST=npgolf-mysql -e DB_PORT=3306 -e DB_NAME=npgolf \
		-e DB_USER=root -e DB_PASS=root -e JWT_SECRET=devsecret \
		npgolf-multi:latest
	```

	Or use an env file (recommended). Make sure your `.env` (or a copy) has `DB_HOST=npgolf-mysql` (not `127.0.0.1`).

	```powershell
	docker run -d --name npgolf --network npgolf_default -p 3000:3000 --env-file .env npgolf-multi:latest
	```

	### 4. Switch to the restricted app user

	After migrations created `npgolf_app`, run with limited privileges:

	```powershell
	docker run -d --name npgolf --network npgolf_default -p 3000:3000 \
		-e DB_HOST=npgolf-mysql -e DB_PORT=3306 -e DB_NAME=npgolf \
		-e DB_USER=npgolf_app -e DB_PASS=app_password -e JWT_SECRET=devsecret \
		npgolf-multi:latest
	```

	If you generated a random password using `npm run create-app-user`, substitute that value for `DB_PASS`.

	### 5. Resolving `ER_ACCESS_DENIED_ERROR` for `npgolf_app`

	If the password you supplied does not match the one stored in MySQL, reset it (inside the MySQL container):

	```powershell
	docker exec npgolf-mysql mysql -uroot -proot -e "ALTER USER 'npgolf_app'@'%' IDENTIFIED BY 'app_password'; FLUSH PRIVILEGES;"
	```

	Then restart the app container (or recreate it with the correct env var):

	```powershell
	docker restart npgolf
	```

	### 6. Verify the deployment

	```powershell
	docker ps --filter "name=npgolf" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
	docker logs npgolf --tail=20
	```

	### 7. Test an API call (registration)

	```powershell
	node -e "const http=require('http');const d=JSON.stringify({name:'Container Test',email:'container.test@example.com',password:'Password123'});const r=http.request({hostname:'localhost',port:3000,path:'/api/users',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},res=>{let b='';res.on('data',x=>b+=x);res.on('end',()=>console.log(res.statusCode,b));});r.write(d);r.end();"
	```

	Expected: HTTP 201 and a JSON response with a new `id` and your email.

	### 8. Common pitfalls

	- Using `127.0.0.1` as `DB_HOST` inside the container: the MySQL server runs in a separate container; use the service/container name (`npgolf-mysql`) while on the same Docker network.
	- Forgetting `--network npgolf_default`: leads to `ECONNREFUSED` or name resolution failures.
	- Mismatched app user password: fix with `ALTER USER` + `FLUSH PRIVILEGES`.
	- Missing `JWT_SECRET`: login will fail (token generation error).

	### 9. Stopping & cleaning up

	```powershell
	docker rm -f npgolf
	docker compose down   # stops MySQL if you used compose
	```

	You can remove the image with:

	```powershell
	docker rmi npgolf-multi:latest -f
	```

	---

# Or stop any Node process (use with care - may stop other Node apps)
Get-Process -Name node -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,StartTime -AutoSize
Stop-Process -Id <PID> -Force
```

- Stop the backend Node server (if started with `npm run start` / `node src/server.js`):

```powershell
# Press Ctrl+C in the server terminal, or
Get-Process -Name node -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,StartTime -AutoSize
Stop-Process -Id <PID> -Force
```

- Stop containers started with `docker run`:

```powershell
docker ps --filter "name=npgolf*" --format "table {{.ID}}	{{.Names}}	{{.Status}}"
docker stop npgolf-backend || docker stop npgolf || docker rm -f npgolf-backend
```

- Stop containers started with `docker-compose`:

```powershell
docker compose down
# or (legacy)
docker-compose down
```

- Remove the loaded image and tarball (if you want to clean up):

```powershell
docker stop npgolf-backend -ErrorAction SilentlyContinue; docker rm npgolf-backend -ErrorAction SilentlyContinue
docker rmi npgolf-multi:latest npgolf-backend:latest -f
Remove-Item .\npgolf-multi.tar -Force -ErrorAction SilentlyContinue
Remove-Item .\npgolf-backend.tar -Force -ErrorAction SilentlyContinue
```

- View container logs (follow):

```powershell
docker logs -f npgolf-backend
```

Notes

- Use the `Get-Process` / `Stop-Process` commands carefully; they will stop any matching Node processes. Prefer pressing Ctrl+C in the original terminal when possible.
- When using Docker commands on Windows, prefer `docker compose` if available. Passing an `--env-file` when running containers ensures your DB credentials and `JWT_SECRET` are available to the container.


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

