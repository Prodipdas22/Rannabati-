# Rannabati Village — Android-first starter project

A small, free-to-build browser game prototype inspired by village-life pretend play. It has a simple 3D village, a controllable character, collectable resources, a cooking action, a home/bed, mobile joystick controls, and an optional Socket.IO server for two-player rooms.

## Files
- `index.html`, `style.css`, `game.js`: browser game frontend
- `server/server.js`, `server/package.json`: realtime multiplayer server

## Test the village locally on Android
1. Download and extract the ZIP.
2. Open `index.html` from a local web server or publish the frontend to GitHub Pages. ES modules often fail when opened as a `file://` URL, so do not test by tapping the HTML file directly.
3. Create a GitHub repository, upload `index.html`, `style.css`, and `game.js` to its root, then open **Settings → Pages** and deploy from the `main` branch / root folder.
4. Visit the GitHub Pages URL in Chrome. Allow the Three.js CDN to load.

## Publish the frontend with GitHub Pages
1. Sign in at https://github.com/ and create a public repository, e.g. `rannabati-village`.
2. Upload the three frontend files (`index.html`, `style.css`, `game.js`) to the repository root.
3. Go to **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
5. Wait for deployment, then open the published URL.

## Deploy the multiplayer server
GitHub Pages cannot run Node.js. Deploy the `server` folder to a Node.js hosting service that offers a free tier, or use another suitable free realtime host. Free plans can sleep, have quotas, and may change.

For a typical Node host:
1. Create a new web service connected to your repository.
2. Set the service root directory to `server`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Use the public HTTPS service URL, for example `https://your-service.example.com`.

The server has a simple health check at `/health`.

## Connect two players
1. Open the game URL on both devices.
2. Expand **Multiplayer server URL** on both devices and enter the same deployed server URL.
3. Tap **Connect server** on both devices.
4. Player 1 taps **Create room** and shares the five-character code.
5. Player 2 enters the code and taps **Join**.

## Current prototype limits
- 3D art uses simple geometric shapes, not final character models.
- The room exists in server memory and disappears when empty or when the server restarts.
- Server-side inventory state is synchronized for room players; this starter is not production-hardened.
- Resources are intentionally simple; later iterations should add per-player interaction validation, proper animations, persistence, reconnect handling, and better resource spawning.
- This starter does not require paid software, a paid domain, or a database. It does require internet access to load the CDN libraries and connect multiplayer.

## Troubleshooting
- **Blank screen:** use the published HTTPS URL, check internet access, and reload.
- **Multiplayer not connecting:** open `https://YOUR-SERVER-URL/health`, confirm it returns `{"status":"ok"}`, and use the exact HTTPS server base URL in the game.
- **Room not found:** create the room first and make sure the server did not restart.


## Updates in this build
- Room invitation links include the room code and multiplayer server URL. Use **Share on WhatsApp** after creating/joining a room. Invitees are connected and auto-join the room when they open the link.
- The Play together panel can be collapsed with the − / + button.
- Socket.IO client loading tries three CDN locations. If all fail, offline play still loads and multiplayer gets a more specific message. A server connection error is reported separately from a missing client library.
- The server URL is remembered in local storage on the device. Keep the server URL and backend running for both players.


## Gameplay upgrade (v2)
- Survival meters: hunger, thirst and energy slowly decrease while you play. Low hunger/thirst or energy reduces walking speed.
- Cook food using 1 food + 1 wood, then use **Eat meal** to restore hunger and a little energy.
- Collect water, then use **Drink** to restore thirst.
- Sleep near the bed to restore energy.
- A village task chain introduces gathering, cooking, eating, drinking and sleeping goals. Completing tasks awards coins and raises your village level.
- Existing room links and multiplayer movement/resource syncing remain in place. Needs, meals, coins and quest progress are currently local to each player; they are not saved across refreshes or synchronized between players.
