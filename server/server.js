const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.get('/', (_req, res) => res.json({
  name: 'Rannabati Village multiplayer server',
  status: 'ok',
  rooms: rooms.size
}));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function roomState(room) {
  const r = rooms.get(room);
  if (!r) return null;
  return {
    inventory: r.inventory,
    collected: [...r.collected],
    players: [...r.players.values()].map(p => ({ id:p.id, x:p.x, z:p.z, rotation:p.rotation }))
  };
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
io.on('connection', socket => {
  socket.on('createRoom', () => {
    leaveCurrentRoom(socket);
    const room = makeCode();
    rooms.set(room, { players: new Map(), inventory: {wood:0,food:0,water:0}, collected: new Set() });
    const r = rooms.get(room);
    const p = { id:socket.id, x:0, z:0, rotation:0 };
    r.players.set(socket.id,p); socket.data.room = room; socket.join(room);
    socket.emit('roomCreated', { room, players: [] });
    socket.emit('state', roomState(room));
  });
  socket.on('joinRoom', code => {
    const room = String(code || '').trim().toUpperCase();
    const r = rooms.get(room);
    if (!r) return socket.emit('roomError', 'Room not found. Ask your friend to create a room first.');
    if (r.players.size >= 2 && !r.players.has(socket.id)) return socket.emit('roomError', 'This room already has two players.');
    leaveCurrentRoom(socket);
    const p = { id:socket.id, x:2, z:2, rotation:0 };
    r.players.set(socket.id,p); socket.data.room = room; socket.join(room);
    socket.emit('roomJoined', { room, players: [...r.players.values()] });
    socket.to(room).emit('playerJoined', p);
    io.to(room).emit('state', roomState(room));
  });
  socket.on('move', data => {
    const room = socket.data.room;
    if (!room || !data || data.room !== room) return;
    const r = rooms.get(room); if (!r || !r.players.has(socket.id)) return;
    const x = Number(data.x), z = Number(data.z), rotation = Number(data.rotation);
    if (![x,z,rotation].every(Number.isFinite)) return;
    const p = r.players.get(socket.id);
    p.x = Math.max(-31, Math.min(31, x)); p.z = Math.max(-31, Math.min(31, z)); p.rotation = rotation;
    socket.to(room).emit('playerMoved', p);
  });
  socket.on('gameAction', payload => {
    const room = socket.data.room;
    if (!room || !payload || payload.room !== room) return;
    const r = rooms.get(room); if (!r || r.players.size < 1) return;
    const { action, data = {} } = payload;
    if (action === 'resourceCollected') {
      const index = Number(data.index), type = String(data.type);
      if (!Number.isInteger(index) || index < 0 || index > 100 || !['wood','food','water'].includes(type)) return;
      if (r.collected.has(index)) return;
      r.collected.add(index); r.inventory[type] += 1;
    } else if (action === 'cooked') {
      if (r.inventory.food < 1 || r.inventory.wood < 1) return;
      r.inventory.food--; r.inventory.wood--;
    } else if (!['sleep','wave'].includes(action)) return;
    socket.to(room).emit('gameAction', { action, data });
    io.to(room).emit('state', roomState(room));
  });
  socket.on('disconnect', () => leaveCurrentRoom(socket));
});
server.listen(PORT, '0.0.0.0', () => console.log(`Rannabati server listening on ${PORT}`));
