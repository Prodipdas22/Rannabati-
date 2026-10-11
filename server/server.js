const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5
});
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const MAX_PLAYERS = 2;
const WORLD_LIMIT = 31;
// Shared day/night cycle: one complete village day every 8 real minutes.
function worldClock() { return { epoch: Date.now(), dayLengthMs: 480000 }; }

app.get('/', (_req, res) => res.json({ name: 'Rannabati Village multiplayer server', status: 'ok', rooms: rooms.size }));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', rooms: rooms.size }));
app.get('/socket.io-health', (_req, res) => res.json({ status: 'ok', socketIo: true, version: require('socket.io/package.json').version }));

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function publicPlayer(p) { return { id: p.id, x: p.x, z: p.z, rotation: p.rotation }; }
const FARM_PLOTS = [
  { x: -12, z: 8 }, { x: -9, z: 8 }, { x: -6, z: 8 },
  { x: -12, z: 11 }, { x: -9, z: 11 }, { x: -6, z: 11 }
];
function freshFarm() {
  return { coins: 20, seeds: 3, produce: 0, crops: FARM_PLOTS.map(() => ({ plantedAt: 0, watered: false, readyAt: 0 })) };
}
function cropStage(crop, now = Date.now()) {
  if (!crop.plantedAt) return 'empty';
  if (crop.readyAt && now >= crop.readyAt) return 'ready';
  if (crop.watered) return 'growing';
  return 'seedling';
}
function publicFarm(farm) {
  const now = Date.now();
  return { coins: farm.coins, seeds: farm.seeds, produce: farm.produce,
    crops: farm.crops.map(c => ({ stage: cropStage(c, now), watered: c.watered, readyAt: c.readyAt || 0 })) };
}
function roomState(room) {
  const r = rooms.get(room);
  if (!r) return null;
  return { inventory: { ...r.inventory }, collected: [...r.collected], players: [...r.players.values()].map(publicPlayer), worldClock: worldClock(), farm: publicFarm(r.farm) };
}
function leaveCurrentRoom(socket) {
  const old = socket.data.room;
  if (!old) return;
  const r = rooms.get(old);
  if (r) {
    r.players.delete(socket.id);
    if (r.lastFarmAction) r.lastFarmAction.delete(socket.id);
    socket.to(old).emit('playerLeft', socket.id);
    if (r.players.size === 0) rooms.delete(old);
    else io.to(old).emit('state', roomState(old));
  }
  socket.leave(old);
  socket.data.room = null;
}
function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function emitRoomSnapshot(socket, room) {
  const state = roomState(room);
  if (state) socket.emit('state', state);
}

io.on('connection', socket => {
  socket.data.room = null;

  socket.on('createRoom', () => {
    leaveCurrentRoom(socket);
    const room = makeCode();
    rooms.set(room, { players: new Map(), inventory: { wood: 0, food: 0, water: 0 }, collected: new Set(), farm: freshFarm(), lastFarmAction: new Map() });
    const r = rooms.get(room);
    r.players.set(socket.id, { id: socket.id, x: 0, z: 0, rotation: 0 });
    socket.data.room = room;
    socket.join(room);
    socket.emit('roomCreated', { room, players: [] });
    socket.emit('worldClock', worldClock());
    emitRoomSnapshot(socket, room);
  });

  socket.on('joinRoom', rawCode => {
    const room = String(rawCode || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(room)) return socket.emit('roomError', 'Enter a valid 5-character room code.');
    const r = rooms.get(room);
    if (!r) return socket.emit('roomError', 'Room not found. Ask your friend to create a room again. Rooms reset when the server restarts.');
    if (socket.data.room === room && r.players.has(socket.id)) {
      socket.emit('roomJoined', { room, players: [...r.players.values()].map(publicPlayer) });
      socket.emit('worldClock', worldClock());
      emitRoomSnapshot(socket, room);
      return;
    }
    if (r.players.size >= MAX_PLAYERS && !r.players.has(socket.id)) return socket.emit('roomError', 'This room already has two players.');
    leaveCurrentRoom(socket);
    const p = { id: socket.id, x: 2, z: 2, rotation: 0 };
    r.players.set(socket.id, p);
    socket.data.room = room;
    socket.join(room);
    socket.emit('roomJoined', { room, players: [...r.players.values()].map(publicPlayer) });
    socket.emit('worldClock', worldClock());
    socket.to(room).emit('playerJoined', publicPlayer(p));
    io.to(room).emit('state', roomState(room));
  });

  socket.on('move', data => {
    const room = socket.data.room;
    if (!room || !data || data.room !== room) return;
    const r = rooms.get(room);
    const p = r && r.players.get(socket.id);
    if (!p) return;
    const x = cleanNumber(data.x, NaN), z = cleanNumber(data.z, NaN), rotation = cleanNumber(data.rotation, NaN);
    if (![x, z, rotation].every(Number.isFinite)) return;
    p.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, x));
    p.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, z));
    p.rotation = Math.max(-Math.PI * 100, Math.min(Math.PI * 100, rotation));
    socket.to(room).volatile.emit('playerMoved', publicPlayer(p));
  });

  socket.on('gameAction', payload => {
    const room = socket.data.room;
    if (!room || !payload || payload.room !== room || typeof payload.action !== 'string') return;
    const r = rooms.get(room);
    if (!r || !r.players.has(socket.id)) return;
    const { action, data = {} } = payload;
    if (action === 'resourceCollected') {
      const index = Number(data.index), type = String(data.type);
      if (!Number.isInteger(index) || index < 0 || index > 100 || !['wood', 'food', 'water'].includes(type)) return;
      if (r.collected.has(index)) return;
      r.collected.add(index);
      r.inventory[type] += 1;
    } else if (action === 'cooked') {
      if (r.inventory.food < 1 || r.inventory.wood < 1) return;
      r.inventory.food -= 1;
      r.inventory.wood -= 1;
    } else if (!['sleep', 'wave'].includes(action)) return;
    socket.to(room).emit('gameAction', { action, data });
    io.to(room).emit('state', roomState(room));
  });

  // V3C: all shared farm mutations are validated and committed on the server.
  socket.on('farmAction', payload => {
    const room = socket.data.room;
    if (!room || !payload || payload.room !== room || typeof payload.action !== 'string') return;
    const r = rooms.get(room), player = r && r.players.get(socket.id);
    if (!r || !player || !r.farm) return;
    const now = Date.now();
    const last = r.lastFarmAction.get(socket.id) || 0;
    if (now - last < 250) return;
    r.lastFarmAction.set(socket.id, now);
    const action = payload.action;
    const index = Number(payload.index);
    const validPlot = Number.isInteger(index) && index >= 0 && index < FARM_PLOTS.length;
    const plot = validPlot ? FARM_PLOTS[index] : null;
    const nearPlot = plot && Math.hypot(player.x - plot.x, player.z - plot.z) <= 4.2;
    const fail = message => socket.emit('farmResult', { ok: false, message, farm: publicFarm(r.farm) });
    if (['plant', 'water', 'harvest'].includes(action) && !validPlot) return fail('Choose a farm plot first.');
    if (['plant', 'water', 'harvest'].includes(action) && !nearPlot) return fail('Move closer to the farm plots first.');
    const crop = validPlot ? r.farm.crops[index] : null;
    if (action === 'plant') {
      if (crop.plantedAt) return fail('This plot already has a crop.');
      if (r.farm.seeds < 1) return fail('No seeds left. Buy seeds from the shop.');
      r.farm.seeds--; crop.plantedAt = now; crop.watered = false; crop.readyAt = 0;
    } else if (action === 'water') {
      if (!crop.plantedAt) return fail('Plant a seed first.');
      if (crop.watered) return fail('This crop has already been watered.');
      if (r.inventory.water < 1) return fail('Collect water first.');
      r.inventory.water--; crop.watered = true; crop.readyAt = now + 30000;
    } else if (action === 'harvest') {
      if (!crop.plantedAt) return fail('Nothing is planted here.');
      if (!crop.readyAt || now < crop.readyAt) return fail('The crop is still growing. Water it and wait 30 seconds.');
      crop.plantedAt = 0; crop.watered = false; crop.readyAt = 0; r.farm.produce++;
    } else if (action === 'buySeed') {
      if (r.farm.coins < 5) return fail('You need 5 shared coins to buy a seed.');
      r.farm.coins -= 5; r.farm.seeds++;
    } else if (action === 'sellProduce') {
      if (r.farm.produce < 1) return fail('Harvest a crop before selling.');
      const sold = r.farm.produce; r.farm.produce = 0; r.farm.coins += sold * 10;
    } else return fail('Unknown farm action.');
    const farm = publicFarm(r.farm);
    io.to(room).emit('farmState', farm);
    io.to(room).emit('state', roomState(room));
    io.to(room).emit('farmResult', { ok: true, message: ({plant:'Seed planted!',water:'Crop watered! It will be ready in 30 seconds.',harvest:'Crop harvested!',buySeed:'Bought one seed for 5 coins.',sellProduce:'Produce sold for 10 coins each.'})[action], farm });
  });

  socket.on('disconnect', () => leaveCurrentRoom(socket));
});
setInterval(() => { for (const room of rooms.keys()) { io.to(room).emit('worldClock', worldClock()); const r = rooms.get(room); if (r && r.farm) io.to(room).emit('farmState', publicFarm(r.farm)); } }, 5000);

server.listen(PORT, '0.0.0.0', () => console.log(`Rannabati server listening on ${PORT}`));
