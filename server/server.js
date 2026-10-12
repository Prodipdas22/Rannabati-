const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
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
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }) : null;
let databaseReady = false;
const saveQueues = new Map();
async function initDatabase() {
  if (!pool) { console.warn('DATABASE_URL is not set; persistence is disabled. Configure a Render PostgreSQL database for durable saves.'); return; }
  await pool.query(`CREATE TABLE IF NOT EXISTS rannabati_room_saves (room_code VARCHAR(5) PRIMARY KEY, snapshot JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  databaseReady = true;
}
function snapshotRoom(r) { return { inventory: { ...r.inventory }, collected: [...r.collected], farm: r.farm, livestock: r.livestock, buildings: r.buildings }; }
async function persistRoom(code) {
  const r = rooms.get(code); if (!pool || !databaseReady || !r) return;
  const snapshot = snapshotRoom(r);
  const previous = saveQueues.get(code) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => pool.query(
    'INSERT INTO rannabati_room_saves (room_code, snapshot, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (room_code) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()',
    [code, JSON.stringify(snapshot)]
  ));
  saveQueues.set(code, current);
  try { await current; } finally { if (saveQueues.get(code) === current) saveQueues.delete(code); }
}
function createRoomState(snapshot) {
  const r = { players: new Map(), inventory: { wood: 0, food: 0, water: 0 }, collected: new Set(), farm: freshFarm(), livestock: freshLivestock(), buildings: freshBuildings(), lastFarmAction: new Map(), lastAnimalAction: new Map(), lastBuildingAction: new Map(), lastMarketAction: new Map() };
  if (snapshot && typeof snapshot === 'object') {
    if (snapshot.inventory && ['wood','food','water'].every(k => Number.isSafeInteger(snapshot.inventory[k]) && snapshot.inventory[k] >= 0 && snapshot.inventory[k] <= 1000000)) r.inventory = { wood: snapshot.inventory.wood, food: snapshot.inventory.food, water: snapshot.inventory.water };
    if (Array.isArray(snapshot.collected) && snapshot.collected.length <= 101) r.collected = new Set(snapshot.collected.filter(n => Number.isInteger(n) && n >= 0 && n <= 100));
    if (snapshot.farm && Number.isSafeInteger(snapshot.farm.coins) && snapshot.farm.coins >= 0 && snapshot.farm.coins <= 100000000 && Number.isSafeInteger(snapshot.farm.seeds) && snapshot.farm.seeds >= 0 && snapshot.farm.seeds <= 1000000 && Number.isSafeInteger(snapshot.farm.produce) && snapshot.farm.produce >= 0 && snapshot.farm.produce <= 1000000 && Array.isArray(snapshot.farm.crops) && snapshot.farm.crops.length === FARM_PLOTS.length && snapshot.farm.crops.every(c => c && Number.isFinite(c.plantedAt) && c.plantedAt >= 0 && typeof c.watered === 'boolean' && Number.isFinite(c.readyAt) && c.readyAt >= 0)) r.farm = snapshot.farm;
    if (snapshot.livestock && Array.isArray(snapshot.livestock.stalls) && snapshot.livestock.stalls.length === ANIMAL_STALLS.length && snapshot.livestock.stalls.every(a => a && ['', 'chicken','goat','cow'].includes(a.type) && Number.isFinite(a.fedAt) && a.fedAt >= 0 && Number.isFinite(a.readyAt) && a.readyAt >= 0) && ['feed','eggs','milk','goatMilk'].every(k => Number.isSafeInteger(snapshot.livestock[k]) && snapshot.livestock[k] >= 0 && snapshot.livestock[k] <= 1000000)) r.livestock = snapshot.livestock;
    if (snapshot.buildings && Array.isArray(snapshot.buildings.sites) && snapshot.buildings.sites.length === BUILD_SITES.length && snapshot.buildings.sites.every(h => h && typeof h.built === 'boolean' && Array.isArray(h.furniture) && h.furniture.length <= 4 && h.furniture.every(f => f && FURNITURE_TYPES.has(f.type) && Number.isInteger(f.slot) && f.slot >= 0 && f.slot <= 3))) r.buildings = snapshot.buildings;
  }
  return r;
}
async function loadRoom(code) {
  if (rooms.has(code)) return rooms.get(code);
  if (!pool || !databaseReady) return null;
  const result = await pool.query('SELECT snapshot FROM rannabati_room_saves WHERE room_code = $1', [code]);
  if (!result.rows.length) return null;
  const room = createRoomState(result.rows[0].snapshot); rooms.set(code, room); return room;
}
const MAX_PLAYERS = 2;
const WORLD_LIMIT = 31;
// Shared day/night cycle: one complete village day every 8 real minutes.
function worldClock() { return { epoch: Date.now(), dayLengthMs: 480000 }; }

app.get('/', (_req, res) => res.json({ name: 'Rannabati Village multiplayer server', status: 'ok', database: databaseReady ? 'connected' : (pool ? 'starting/unavailable' : 'not-configured'), rooms: rooms.size }));
app.get('/health', (_req, res) => res.status(pool && !databaseReady ? 503 : 200).json({ status: pool && !databaseReady ? 'degraded' : 'ok', database: databaseReady, rooms: rooms.size }));
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
// V3D livestock stalls are fixed world positions; the server validates proximity.
const ANIMAL_STALLS = [{x:8,z:8},{x:11,z:8},{x:14,z:8},{x:8,z:12}];
const ANIMAL_PRICES = { chicken: 10, goat: 25, cow: 30 };
const ANIMAL_PRODUCTS = { chicken: 'eggs', goat: 'goatMilk', cow: 'milk' };
// V3E construction sites are fixed server-validated world positions.
const BUILD_SITES = [{x:19,z:-5},{x:25,z:-5},{x:22,z:2}];
const FURNITURE_TYPES = new Set(['bed','table','chair','chest']);
// V3F market prices are server-owned; clients can request actions, never set prices or amounts.
const MARKET_POSITION = { x: 0, z: -10 };
const MARKET_BUY_PRICES = { buySeed: 5, buyWood: 6, buyFood: 4, buyWater: 3 };
const MARKET_SELL_PRICES = { sellProduce: 10, sellEggs: 8, sellMilk: 8, sellGoatMilk: 8 };
const HOUSE_WOOD_COST = 3, HOUSE_COIN_COST = 8, FURNITURE_WOOD_COST = 1, FURNITURE_COIN_COST = 3;
function freshFarm() {
  return { coins: 20, seeds: 3, produce: 0, crops: FARM_PLOTS.map(() => ({ plantedAt: 0, watered: false, readyAt: 0 })) };
}
function freshLivestock() {
  return { stalls: ANIMAL_STALLS.map(() => ({ type: '', fedAt: 0, readyAt: 0 })), feed: 0, eggs: 0, milk: 0, goatMilk: 0 };
}
function freshBuildings() { return { sites: BUILD_SITES.map(() => ({ built: false, furniture: [] })) }; }
function publicBuildings(buildings) { return { sites: buildings.sites.map(h => ({ built: !!h.built, furniture: h.furniture.map(f => ({ type: f.type, slot: f.slot })) })) }; }
function publicLivestock(livestock, farm) {
  const now = Date.now();
  return { coins: farm.coins, feed: livestock.feed, eggs: livestock.eggs, milk: livestock.milk, goatMilk: livestock.goatMilk,
    stalls: livestock.stalls.map(a => ({ type: a.type, fed: !!a.fedAt, ready: !!a.readyAt && now >= a.readyAt, readyAt: a.readyAt || 0 })) };
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
  return { inventory: { ...r.inventory }, collected: [...r.collected], players: [...r.players.values()].map(publicPlayer), worldClock: worldClock(), farm: publicFarm(r.farm), livestock: publicLivestock(r.livestock, r.farm), buildings: publicBuildings(r.buildings) };
}
function leaveCurrentRoom(socket) {
  const old = socket.data.room;
  if (!old) return;
  const r = rooms.get(old);
  if (r) {
    r.players.delete(socket.id);
    if (r.lastFarmAction) r.lastFarmAction.delete(socket.id);
    if (r.lastAnimalAction) r.lastAnimalAction.delete(socket.id);
    if (r.lastBuildingAction) r.lastBuildingAction.delete(socket.id);
    if (r.lastMarketAction) r.lastMarketAction.delete(socket.id);
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

  socket.on('createRoom', async () => {
    leaveCurrentRoom(socket);
    const room = makeCode();
    rooms.set(room, createRoomState(null));
    await persistRoom(room).catch(err => console.error('Initial room save failed:', err.message));
    const r = rooms.get(room);
    r.players.set(socket.id, { id: socket.id, x: 0, z: 0, rotation: 0 });
    socket.data.room = room;
    socket.join(room);
    socket.emit('roomCreated', { room, players: [] });
    socket.emit('worldClock', worldClock());
    emitRoomSnapshot(socket, room);
  });

  socket.on('joinRoom', async rawCode => {
    const room = String(rawCode || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(room)) return socket.emit('roomError', 'Enter a valid 5-character room code.');
    let r;
    try { r = rooms.get(room) || await loadRoom(room); } catch (err) { console.error('Room restore failed:', err.message); return socket.emit('roomError', 'Could not restore this village. Please try again shortly.'); }
    if (!r) return socket.emit('roomError', 'Room not found. Ask your friend to create a room first.');
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

  socket.on('gameAction', async payload => {
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
      persistRoom(room).catch(err => console.error('Save failed:', err.message));
    } else if (action === 'cooked') {
      if (r.inventory.food < 1 || r.inventory.wood < 1) return;
      r.inventory.food -= 1;
      r.inventory.wood -= 1;
      persistRoom(room).catch(err => console.error('Save failed:', err.message));
    } else if (!['sleep', 'wave'].includes(action)) return;
    await persistRoom(room).catch(err => console.error('Save failed:', err.message));
    socket.to(room).emit('gameAction', { action, data });
    io.to(room).emit('state', roomState(room));
  });

  // V3C: all shared farm mutations are validated and committed on the server.
  socket.on('farmAction', async payload => {
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
    await persistRoom(room).catch(err => console.error('Save failed:', err.message));
    const farm = publicFarm(r.farm);
    io.to(room).emit('farmState', farm);
    io.to(room).emit('state', roomState(room));
    io.to(room).emit('farmResult', { ok: true, message: ({plant:'Seed planted!',water:'Crop watered! It will be ready in 30 seconds.',harvest:'Crop harvested!',buySeed:'Bought one seed for 5 coins.',sellProduce:'Produce sold for 10 coins each.'})[action], farm });
  });

  // V3D: server-authoritative shared livestock, feeding, production and sales.
  socket.on('animalAction', async payload => {
    const room = socket.data.room;
    if (!room || !payload || payload.room !== room || typeof payload.action !== 'string') return;
    const r = rooms.get(room), player = r && r.players.get(socket.id);
    if (!r || !player || !r.livestock || !r.farm) return;
    const now = Date.now();
    const last = r.lastAnimalAction.get(socket.id) || 0;
    if (now - last < 300) return;
    r.lastAnimalAction.set(socket.id, now);
    const action = payload.action;
    const index = Number(payload.index);
    const validStall = Number.isInteger(index) && index >= 0 && index < ANIMAL_STALLS.length;
    const stallPos = validStall ? ANIMAL_STALLS[index] : null;
    const nearStall = stallPos && Math.hypot(player.x - stallPos.x, player.z - stallPos.z) <= 4.5;
    const animal = validStall ? r.livestock.stalls[index] : null;
    const fail = message => socket.emit('animalResult', { ok: false, message, livestock: publicLivestock(r.livestock, r.farm), farm: publicFarm(r.farm) });
    if (['buyChicken','buyGoat','buyCow','feed','collect'].includes(action)) {
      if (!validStall) return fail('Choose an animal stall first.');
      if (!nearStall) return fail('Move closer to the animal pen first.');
    }
    if (action.startsWith('buy')) {
      const type = ({buyChicken:'chicken',buyGoat:'goat',buyCow:'cow'})[action];
      if (!type) return fail('Unknown livestock purchase.');
      if (animal.type) return fail('This stall is already occupied.');
      const price = ANIMAL_PRICES[type];
      if (r.farm.coins < price) return fail(`You need ${price} shared coins to buy a ${type}.`);
      r.farm.coins -= price;
      animal.type = type; animal.fedAt = 0; animal.readyAt = 0;
    } else if (action === 'feed') {
      if (!animal.type) return fail('Buy an animal for this stall first.');
      if (animal.fedAt) return fail('This animal has already been fed. Collect its product first.');
      if (r.farm.coins < 2) return fail('You need 2 shared coins to buy animal feed.');
      r.farm.coins -= 2; // Feed is consumed immediately; the animal's production timer is stored server-side.
      animal.fedAt = now; animal.readyAt = now + 30000;
    } else if (action === 'collect') {
      if (!animal.type) return fail('There is no animal in this stall.');
      if (!animal.readyAt || now < animal.readyAt) return fail('The animal needs more time. Feed it and wait 30 seconds.');
      const product = ANIMAL_PRODUCTS[animal.type];
      r.livestock[product] += 1; animal.fedAt = 0; animal.readyAt = 0;
    } else if (action === 'sellProducts') {
      const count = r.livestock.eggs + r.livestock.milk + r.livestock.goatMilk;
      if (!count) return fail('Collect eggs or milk before selling.');
      r.livestock.eggs = 0; r.livestock.milk = 0; r.livestock.goatMilk = 0;
      r.farm.coins += count * 8;
    } else return fail('Unknown animal action.');
    await persistRoom(room).catch(err => console.error('Save failed:', err.message));
    const farm = publicFarm(r.farm), livestock = publicLivestock(r.livestock, r.farm);
    io.to(room).emit('farmState', farm);
    io.to(room).emit('livestockState', livestock);
    io.to(room).emit('state', roomState(room));
    const messages = { buyChicken:'Chicken added to the shared pen!', buyGoat:'Goat added to the shared pen!', buyCow:'Cow added to the shared pen!', feed:'Animal fed! Product ready in 30 seconds.', collect:'Product collected!', sellProducts:'Animal products sold for 8 coins each.' };
    io.to(room).emit('animalResult', { ok: true, message: messages[action], livestock, farm });
  });

  // V3E: house and furniture transactions are authoritative on the server.
  socket.on('buildingAction', async payload => {
    const room = socket.data.room;
    if (!room || !payload || payload.room !== room || typeof payload.action !== 'string') return;
    const r = rooms.get(room), player = r && r.players.get(socket.id);
    if (!r || !player || !r.buildings || !r.farm || !r.inventory) return;
    const now = Date.now(), last = r.lastBuildingAction.get(socket.id) || 0;
    if (now - last < 350) return;
    r.lastBuildingAction.set(socket.id, now);
    const action = payload.action, index = Number(payload.index);
    const validSite = Number.isInteger(index) && index >= 0 && index < BUILD_SITES.length;
    const site = validSite ? BUILD_SITES[index] : null;
    const nearSite = site && Math.hypot(player.x - site.x, player.z - site.z) <= 5.5;
    const house = validSite ? r.buildings.sites[index] : null;
    const fail = message => socket.emit('buildingResult', { ok: false, message, buildings: publicBuildings(r.buildings), inventory: { ...r.inventory }, farm: publicFarm(r.farm) });
    if (!validSite) return fail('Choose a building site first.');
    if (!nearSite) return fail('Move closer to the selected building site.');
    if (action === 'buildHouse') {
      if (house.built) return fail('This house has already been built.');
      if (r.inventory.wood < HOUSE_WOOD_COST) return fail(`Gather ${HOUSE_WOOD_COST} wood first.`);
      if (r.farm.coins < HOUSE_COIN_COST) return fail(`You need ${HOUSE_COIN_COST} shared coins to build.`);
      r.inventory.wood -= HOUSE_WOOD_COST; r.farm.coins -= HOUSE_COIN_COST;
      house.built = true; house.furniture = [];
    } else if (action === 'placeFurniture') {
      const type = String(payload.type || ''), slot = Number(payload.slot);
      if (!house.built) return fail('Build this house before placing furniture.');
      if (!FURNITURE_TYPES.has(type)) return fail('Choose valid furniture.');
      if (!Number.isInteger(slot) || slot < 0 || slot > 3) return fail('Choose a valid furniture spot.');
      if (house.furniture.some(f => f.slot === slot)) return fail('That furniture spot is occupied.');
      if (r.inventory.wood < FURNITURE_WOOD_COST) return fail(`Gather ${FURNITURE_WOOD_COST} wood first.`);
      if (r.farm.coins < FURNITURE_COIN_COST) return fail(`You need ${FURNITURE_COIN_COST} shared coins for furniture.`);
      r.inventory.wood -= FURNITURE_WOOD_COST; r.farm.coins -= FURNITURE_COIN_COST;
      house.furniture.push({ type, slot });
    } else return fail('Unknown building action.');
    await persistRoom(room).catch(err => console.error('Save failed:', err.message));
    const buildings = publicBuildings(r.buildings), farm = publicFarm(r.farm);
    io.to(room).emit('buildingsState', buildings);
    io.to(room).emit('farmState', farm);
    io.to(room).emit('state', roomState(room));
    socket.emit('buildingResult', { ok: true, message: action === 'buildHouse' ? 'House built! Place furniture next.' : `${String(payload.type)} placed!`, buildings, inventory: { ...r.inventory }, farm });
  });

  // V3F: secure shared market transactions. Prices, quantities and stock are server-controlled.
  socket.on('marketAction', async payload => {
    const room = socket.data.room;
    if (!room || !payload || payload.room !== room || typeof payload.action !== 'string') return;
    const r = rooms.get(room), player = r && r.players.get(socket.id);
    if (!r || !player || !r.farm || !r.livestock || !r.inventory) return;
    const now = Date.now(), last = r.lastMarketAction.get(socket.id) || 0;
    if (now - last < 300) return;
    r.lastMarketAction.set(socket.id, now);
    if (Math.hypot(player.x - MARKET_POSITION.x, player.z - MARKET_POSITION.z) > 6) {
      return socket.emit('marketResult', { ok: false, message: 'Move closer to the village market stall.' });
    }
    const action = payload.action;
    let tradedCount = 0;
    const fail = message => socket.emit('marketResult', { ok: false, message, state: { inventory: { ...r.inventory }, farm: publicFarm(r.farm), livestock: publicLivestock(r.livestock, r.farm) } });
    if (Object.prototype.hasOwnProperty.call(MARKET_BUY_PRICES, action)) {
      const price = MARKET_BUY_PRICES[action];
      if (r.farm.coins < price) return fail(`You need ${price} shared coins for this purchase.`);
      // Bound each click to exactly one unit; no client-supplied quantity or price is accepted.
      r.farm.coins -= price;
      if (action === 'buySeed') r.farm.seeds += 1;
      else if (action === 'buyWood') r.inventory.wood += 1;
      else if (action === 'buyFood') r.inventory.food += 1;
      else if (action === 'buyWater') r.inventory.water += 1;
    } else if (Object.prototype.hasOwnProperty.call(MARKET_SELL_PRICES, action)) {
      if (action === 'sellProduce') { tradedCount = r.farm.produce; if (tradedCount < 1) return fail('Harvest crops before selling.'); r.farm.produce = 0; }
      else if (action === 'sellEggs') { tradedCount = r.livestock.eggs; if (tradedCount < 1) return fail('Collect eggs before selling.'); r.livestock.eggs = 0; }
      else if (action === 'sellMilk') { tradedCount = r.livestock.milk; if (tradedCount < 1) return fail('Collect cow milk before selling.'); r.livestock.milk = 0; }
      else if (action === 'sellGoatMilk') { tradedCount = r.livestock.goatMilk; if (tradedCount < 1) return fail('Collect goat milk before selling.'); r.livestock.goatMilk = 0; }
      r.farm.coins += tradedCount * MARKET_SELL_PRICES[action];
    } else return fail('Unknown market transaction.');
    await persistRoom(room).catch(err => console.error('Save failed:', err.message));
    const state = { inventory: { ...r.inventory }, farm: publicFarm(r.farm), livestock: publicLivestock(r.livestock, r.farm) };
    io.to(room).emit('state', roomState(room));
    io.to(room).emit('farmState', state.farm);
    io.to(room).emit('livestockState', state.livestock);
    io.to(room).emit('marketResult', { ok: true, message: ({ buySeed:'Bought 1 seed for 5 coins.', buyWood:'Bought 1 wood for 6 coins.', buyFood:'Bought 1 food for 4 coins.', buyWater:'Bought 1 water for 3 coins.', sellProduce:`Sold ${tradedCount} crop${tradedCount===1?'':'s'} for ${tradedCount*10} coins.`, sellEggs:`Sold ${tradedCount} egg${tradedCount===1?'':'s'} for ${tradedCount*8} coins.`, sellMilk:`Sold ${tradedCount} milk for ${tradedCount*8} coins.`, sellGoatMilk:`Sold ${tradedCount} goat milk for ${tradedCount*8} coins.` })[action], state });
  });

  socket.on('disconnect', () => leaveCurrentRoom(socket));
});
setInterval(() => { for (const room of rooms.keys()) { io.to(room).emit('worldClock', worldClock()); const r = rooms.get(room); if (r && r.farm) io.to(room).emit('farmState', publicFarm(r.farm)); if (r && r.livestock) io.to(room).emit('livestockState', publicLivestock(r.livestock, r.farm)); if (r && r.buildings) io.to(room).emit('buildingsState', publicBuildings(r.buildings)); } }, 5000);

initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => console.log(`Rannabati server listening on ${PORT}`));
}).catch(err => { console.error('Database initialization failed:', err); process.exit(1); });
