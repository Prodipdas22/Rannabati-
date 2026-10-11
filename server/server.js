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
function roomState(room) {
  const r = rooms.get(room);
  if (!r) return null;
  return { inventory: { ...r.inventory }, collected: [...r.collected], players: [...r.players.values()].map(publicPlayer), worldClock: worldClock() };
}
function leaveCurrentRoom(socket) {
  const old = socket.data.room;
  if (!old) return;
  const r = rooms.get(old);
  if (r) {
    r.players.delete(socket.id);
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
    rooms.set(room, { players: new Map(), inventory: { wood: 0, food: 0, water: 0 }, collected: new Set() });
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

  socket.on('disconnect', () => leaveCurrentRoom(socket));
});
setInterval(() => { for (const room of rooms.keys()) io.to(room).emit('worldClock', worldClock()); }, 5000);

server.listen(PORT, '0.0.0.0', () => console.log(`Rannabati server listening on ${PORT}`));
