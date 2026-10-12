# Rannabati Village — Production-Oriented Web Game Bundle

This package assembles the latest V3I game frontend (including landscape fullscreen request) with the V3H Socket.IO backend and PostgreSQL snapshot persistence, plus a responsive HUD and mobile controls layout.

## Project contents
- `index.html` — frontend page and required DOM IDs for the game logic
- `style.css` — responsive earthy village UI, safe-area and landscape rules
- `game.js` — Three.js world, player movement, resources, needs, quests, farming, livestock, building, market and multiplayer client
- `server/server.js` — Node.js/Express/Socket.IO backend with shared-room actions and PostgreSQL snapshot persistence
- `server/package.json` — backend dependencies and start script
- `render.yaml` — optional Render blueprint for the backend
- `.gitignore` — excludes local environment files and dependencies

## Frontend deployment (GitHub Pages)
1. Upload `index.html`, `style.css`, and `game.js` to the root of your GitHub repository.
2. Open **Settings → Pages** and deploy from the `main` branch, root folder.
3. Open the published HTTPS URL in Chrome. Three.js and Socket.IO are loaded from public CDNs, so an internet connection is required.

## Backend deployment (Render)
1. Deploy this repository as a Render Web Service with **Root Directory** `server`.
2. Build command: `npm install`
3. Start command: `npm start`
4. Create a PostgreSQL database and set `DATABASE_URL` on the web service to the database's private/internal connection URL when available.
5. Set `DATABASE_SSL` only if your database provider requires it. Default is managed PostgreSQL TLS with certificate verification disabled for compatibility; follow your provider's current TLS guidance.
6. Confirm `https://YOUR-SERVICE/health` reports `{"status":"ok","database":true,...}` before treating durable persistence as configured.
7. On the game, open **Multiplayer connection**, enter the backend's HTTPS URL, and tap **Connect server** on both devices. One player creates a room; the other joins using the room code or invite link.

## Mobile usage
- Use the on-screen joystick or WASD/arrow keys.
- Tap **Fullscreen** in the game interface. On compatible mobile browsers, the game requests landscape orientation after the user gesture; otherwise rotate the device manually.
- UI spacing adapts to narrow, tall and landscape viewports.

## Validation performed
- JavaScript syntax checks are part of the packaging workflow.
- A full live deployment, two-device multiplayer test, and real PostgreSQL restart/recovery test have not been run in this environment; perform those checks before a public launch.

## Important production notes
This is a deployable project bundle, but it should not be described as fully production-certified until the deployment checks above pass. The current backend stores shared room snapshots, not an immutable event ledger; player positions are transient. Configure a database and monitor `/health`. Free hosting tiers may sleep or have usage limits. Room codes are invitation codes, not user authentication. The backend currently uses permissive Socket.IO CORS to support GitHub Pages deployment; for a public launch, set an explicit frontend-origin allowlist in the server configuration and add abuse/rate controls appropriate to your audience.
