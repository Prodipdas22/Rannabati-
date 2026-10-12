Rannabati Village — Play Together panel cleanup

Changed file:
- game.js

What changed:
- Removes the visible “Multiplayer server URL” disclosure from the Play Together panel.
- Keeps the server URL hidden from normal gameplay UI.
- Reuses a server URL previously saved in this browser, or a server URL supplied in an invitation URL using ?server=...
- Automatically connects when a saved/invitation server URL is available.
- Keeps create/join room, room sharing, and existing multiplayer/gameplay handlers intact.

Important:
- This change does not hard-code a Render server URL. If this browser has never saved a server URL and the player did not open an invitation link containing ?server=..., multiplayer cannot connect. Configure the server URL through the deployment/invitation flow before distributing the game.
- Do not put database credentials or other secrets in the GitHub Pages frontend.

Install:
1. Back up the existing root game.js.
2. Replace only the root game.js with the file in this ZIP.
3. Commit/push to GitHub Pages and refresh the game.
4. Test a room invite link on two devices.
