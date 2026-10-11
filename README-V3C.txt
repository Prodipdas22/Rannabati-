RANNABATI VILLAGE V3C — SHARED FARMING & ECONOMY

Changed files in this ZIP:
1) game.js
2) server/server.js

INSTALL
1. In the GitHub repository root, replace game.js with this version.
2. In the server folder, replace server.js with this version.
3. Commit the changes and wait for GitHub Pages and Render to deploy.
4. Keep index.html, style.css, server/package.json, and socket.io.min.js unchanged.

HOW TO PLAY
- Join/create a multiplayer room. Shared farm actions require a room and a live backend.
- Farm plots are around x=-12..-6 and z=8..11. Walk close to a plot.
- Plant consumes one shared seed.
- Water consumes one shared water from the existing resource inventory.
- Crops become ready 30 seconds after watering.
- Harvest adds one shared produce item.
- Buy seed costs 5 shared coins. Selling each produce earns 10 shared coins.
- The server validates plot proximity, crop stage, seed/water availability, and coin transactions.
- Farm/crop state is in server memory and resets if Render restarts or a room is deleted.

IMPORTANT
- Shared farming/economy only works while connected to the existing Render Socket.IO server.
- This package preserves the existing game and server structure; JavaScript syntax checks passed, but test the deployed game on two phones before relying on multiplayer behavior.
