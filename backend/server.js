import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cookie from 'cookie';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const users = {};
const powerups = new Map();
let nextPowerupId = 1;
const takenSpawns = new Map();

const mapWidth = 15;
const mapHeight = 13;
const spawnPoints = [
    { x: 1, y: 1 },
    { x: 13, y: 1 },
    { x: 1, y: 11 },
    { x: 13, y: 11 }
];

const availableColors = ['blue', 'brown', 'grey', 'yellow'];

function createPowerup({ type, x, y }) {
    const id = String(nextPowerupId++);
    const pu = { id, type, x, y };
    powerups.set(id, pu);
    return pu;
}

function getAvailableColor() {
    const taken = new Set(Object.values(users).map(u => u.color));
    return availableColors.find(c => !taken.has(c)) || 'blue';
}

function generateMapData(width, height) {
    const grid = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                row.push(2);
            } else if (
                (x === 1 && y === 1) || (x === 1 && y === 2) || (x === 2 && y === 1) ||
                (x === width - 2 && y === 1) || (x === width - 3 && y === 1) || (x === width - 2 && y === 2) ||
                (x === 1 && y === height - 2) || (x === 2 && y === height - 2) || (x === 1 && y === height - 3) ||
                (x === width - 2 && y === height - 2) || (x === width - 2 && y === height - 3) || (x === width - 3 && y === height - 2)
            ) {
                row.push(0);
            } else if (x % 2 === 0 && y % 2 === 0) {
                row.push(2);
            } else {
                const isRandomWall = Math.random() < 0.4;
                row.push(isRandomWall ? 1 : 0);
            }
        }
        grid.push(row);
    }
    return grid;
}

const mapData = generateMapData(mapWidth, mapHeight);

function getAvailableSpawn() {
    return spawnPoints.find(spawn =>
        ![...takenSpawns.values()].some(p => p.x === spawn.x && p.y === spawn.y)
    );
}

function broadcast(type, payload) {
    const msg = JSON.stringify({ type, ...payload });
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(msg);
        }
    });
}

function explodeServerBomb(user, bx, by) {
    const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];
    const range = Math.max(1, user?.stats?.flameRange ?? 1);

    maybeDestroyAndSpawn(bx, by);

    for (const [dx, dy] of dirs) {
        for (let k = 1; k <= range; k++) {
            const fx = bx + dx * k;
            const fy = by + dy * k;
            if (fx < 0 || fx >= mapWidth || fy < 0 || fy >= mapHeight) break;

            const cell = mapData[fy][fx];
            if (cell === 2) break;

            if (cell === 1) {
                mapData[fy][fx] = 0;
                maybeSpawnPowerup(fx, fy);
                break;
            }
        }
    }
}

function maybeDestroyAndSpawn(x, y) {
    if (mapData[y][x] === 1) {
        mapData[y][x] = 0;
        maybeSpawnPowerup(x, y);
    }
}

function maybeSpawnPowerup(x, y) {
    const roll = Math.random();
    const type =
        roll < 0.15 ? 'flames' :
            roll < 0.30 ? 'bombs' :
                roll < 0.45 ? 'speed' :
                    null;

    if (!type) return;

    const pu = createPowerup({ type, x, y });

    const occupant = Object.values(users).find(u => u.x === x && u.y === y);
    if (occupant) return;

    broadcast('powerup-spawn', { powerup: pu });
}

wss.on('connection', (ws, req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const playerId = cookies.player_id;

    if (!playerId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Missing player_id cookie' }));
        ws.close();
        return;
    }

    ws.send(JSON.stringify({ type: 'map-data', grid: mapData }));

    ws.on('message', (msg) => {
        const raw = msg.toString();
        console.log('Received raw msg:', raw);

        let data;
        try {
            data = JSON.parse(msg);
        } catch (err) {
            console.error('Invalid JSON:', msg);
            return;
        }

        if (data.type === 'request-map') {
            ws.send(JSON.stringify({ type: 'map-data', grid: mapData }));
        }

        if (data.type === 'check-join') {
            const anyPlaying = Object.values(users).some(u => u.x !== null && u.y !== null);
            if (anyPlaying || Object.keys(users).length >= 4) {
                ws.send(JSON.stringify({ type: 'check-join-response', allowed: false, message: 'Game in progress or lobby full' }));
            } else {
                ws.send(JSON.stringify({ type: 'check-join-response', allowed: true }));
            }
        }

        if (data.type === 'new-user') {
            if (Object.keys(users).length >= 4) {
                ws.send(JSON.stringify({ type: 'error', message: 'Lobby full (max 4 players)' }));
                ws.close();
                return;
            }

            users[data.id] = {
                id: data.id,
                name: data.name,
                ws,
                x: null,
                y: null,
                color: getAvailableColor(),
                stats: {
                    maxBombs: 1,
                    flameRange: 1,
                    moveIntervalMs: 100,
                    speedLevel: 0
                },
                activeBombs: 0,
                lastMoveAt: 0,
            };

            broadcast('user-list', {
                users: Object.values(users).map(u => ({
                    id: u.id,
                    name: u.name,
                    status: (u.x !== null && u.y !== null) ? 'playing' : 'waiting',
                    color: u.color
                }))
            });
        }

        if (data.type === 'start-game') {
            if (!users[data.id]) return;

            // --- REGENERATE MAP FOR NEW GAME ---
            mapData.length = 0; // clear old map
            const newMap = generateMapData(mapWidth, mapHeight);
            newMap.forEach(row => mapData.push(row));

            if (takenSpawns.has(data.id)) {
                takenSpawns.delete(data.id);
            }

            const spawn = getAvailableSpawn();
            if (!spawn) {
                ws.send(JSON.stringify({ type: 'error', message: 'Game full' }));
                return;
            }

            users[data.id].x = spawn.x;
            users[data.id].y = spawn.y;
            users[data.id].spawn = { ...spawn };
            takenSpawns.set(data.id, spawn);

            const others = Object.values(users)
                .filter(u => u.id !== data.id && u.x !== null && u.y !== null)
                .map(u => ({ id: u.id, name: u.name, x: u.x, y: u.y, color: u.color }));

            if (others.length > 0) {
                ws.send(JSON.stringify({
                    type: 'existing-players',
                    players: others
                }));
            }

            ws.send(JSON.stringify({
                type: 'spawn-position',
                id: data.id,
                x: spawn.x,
                y: spawn.y,
                color: users[data.id].color
            }));

            broadcast('spawn-position', {
                id: data.id,
                x: spawn.x,
                y: spawn.y,
                color: users[data.id].color
            });
        }

        if (data.type === 'player-move') {
            const u = users[data.id];
            if (!u) return;

            const now = Date.now();
            const MOVE_INTERVAL_MS = u.stats?.moveIntervalMs ?? 100;
            if (u.lastMoveAt && now - u.lastMoveAt < MOVE_INTERVAL_MS) return;
            u.lastMoveAt = now;

            const dx = Math.abs((data.x ?? u.x) - (u.x ?? 0));
            const dy = Math.abs((data.y ?? u.y) - (u.y ?? 0));
            if (dx + dy !== 1) return;
            if (data.x < 0 || data.x >= mapWidth || data.y < 0 || data.y >= mapHeight) return;
            if (mapData[data.y][data.x] === 1 || mapData[data.y][data.x] === 2) return;

            u.x = data.x;
            u.y = data.y;

            const moveData = JSON.stringify({ type: 'player-move', id: data.id, x: data.x, y: data.y });
            wss.clients.forEach(client => {
                if (client.readyState === ws.OPEN) client.send(moveData);
            });
        }

        if (data.type === 'bomb') {
            const u = users[data.id];
            if (!u) return;
            if (u.activeBombs >= u.stats.maxBombs) return;
            u.activeBombs++;

            broadcast('bomb', { type: 'bomb', id: data.id, x: data.x, y: data.y });

            setTimeout(() => {
                try { explodeServerBomb(u, data.x, data.y); }
                finally { u.activeBombs = Math.max(0, u.activeBombs - 1); }
            }, 2000);
        }

        if (data.type === 'pickup-powerup') {
            const u = users[data.id];
            if (!u) return;
            const pu = powerups.get(data.powerupId);
            if (!pu) return;
            if (u.x !== pu.x || u.y !== pu.y) return;

            if (pu.type === 'bombs') {
                u.stats.maxBombs += 1;
                powerups.delete(pu.id);
                broadcast('powerup-picked', { id: pu.id, by: u.id, powerupType: 'bombs', newMaxBombs: u.stats.maxBombs });
            } else if (pu.type === 'flames') {
                u.stats.flameRange = (u.stats.flameRange || 1) + 1;
                powerups.delete(pu.id);
                broadcast('powerup-picked', { id: pu.id, by: u.id, powerupType: 'flames', newFlameRange: u.stats.flameRange });
            } else if (pu.type === 'speed') {
                const current = u.stats.moveIntervalMs ?? 120;
                const next = Math.max(30, current - 50);
                u.stats.moveIntervalMs = next;
                u.stats.speedLevel = (u.stats.speedLevel || 0) + 1;
                powerups.delete(pu.id);
                broadcast('powerup-picked', { id: pu.id, by: u.id, powerupType: 'speed', newMoveIntervalMs: next, newSpeedLevel: u.stats.speedLevel });
            }
        }

        if (data.type === 'respawn') {
            const u = users[data.id];
            if (!u || !u.spawn) return;

            u.x = u.spawn.x;
            u.y = u.spawn.y;
            u.lastMoveAt = 0;

            u.ws.send(JSON.stringify({ type: 'spawn-position', id: u.id, x: u.x, y: u.y, color: u.color }));
            broadcast('player-move', { id: u.id, x: u.x, y: u.y });
            return;
        }

        if (data.type === 'chat-message') {
            console.log('[CHAT] Incoming:', data);

            const { id, room, text } = data.payload;
            if (!id) return;

            const user = users[id];
            if (!user) return;

            const message = { type: 'chat-message', room, id, from: user.name, text };
            const messageStr = JSON.stringify(message);

            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) client.send(messageStr);
            });
        }
    });

    ws.on('close', () => {
        const userEntry = Object.entries(users).find(([id, u]) => u.ws === ws);
        if (userEntry) {
            const [id] = userEntry;
            takenSpawns.delete(id);
            delete users[id];
            broadcast('player-disconnect', { id });
        }
    });
});

app.use(express.static(path.join(__dirname, '../public')));

const PORT = 8000;
server.listen(PORT, () => {
    console.log(`✅ HTTP + WS server running at http://localhost:${PORT}`);
});
