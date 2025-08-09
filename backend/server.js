import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cookie from 'cookie';

const __filename = fileURLToPath(
    import.meta.url);
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

const availableColors = ['blue', 'yellow', 'brown', 'grey'];

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
    const dir = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];

    dir.forEach(([dx, dy]) => {
        const fx = bx + dx;
        const fy = by + dy;
        if (fx < 0 || fx >= mapWidth || fy < 0 || fy >= mapHeight) return;
        if (mapData[fy][fx] === 2) return;

        if (mapData[fy][fx] === 1) {
            mapData[fy][fx] = 0;

            if (Math.random() < 1.0) {
                const pu = createPowerup({ type: 'bombs', x: fx, y: fy });
                broadcast('powerup-spawn', {
                    powerup: pu
                });
            }
        }
    })
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
                stats: { maxBombs: 1 },
                activeBombs: 0
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
            if (users[data.id]) {
                users[data.id].x = data.x;
                users[data.id].y = data.y;
            }

            const moveData = JSON.stringify({
                type: 'player-move',
                id: data.id,
                x: data.x,
                y: data.y
            });

            wss.clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(moveData);
                }
            });

            const pu = [...powerups.values()].find(p => p.x === data.x && p.y === data.y);
            if (pu) {
                const u = users[data.id];
                if (pu.type === 'bombs') {
                    u.stats.maxBombs += 1;
                }
                powerups.delete(pu.id);
                broadcast('powerup-picked', {
                    id: pu.id,
                    by: u.id,
                    powerupType: pu.type,
                    newMaxBombs: u.stats.maxBombs
                });
            }
        }

        if (data.type === 'bomb') {
            const u = users[data.id];
            if (!u) return;

            if (u.activeBombs >= u.stats.maxBombs) {
                ws.send(JSON.stringify({ type: 'error', message: 'bomb cap reached' }));
                return;
            }

            u.activeBombs++;

            broadcast('bomb', {
                type: 'bomb',
                id: data.id,
                x: data.x,
                y: data.y
            });

            setTimeout(() => {
                try {
                    explodeServerBomb(u, data.x, data.y);
                } finally {
                    u.activeBombs = Math.max(0, u.activeBombs - 1);
                }
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
                broadcast('powerup-picked', {
                    id: pu.id,
                    by: u.id,
                    type: pu.type,
                    newMaxBombs: u.stats.maxBombs
                });
            }
        }

        if (data.type === 'chat-message') {
            console.log('[CHAT] Incoming:', data);

            const { id, room, text } = data.payload;
            if (!id) {
                console.warn('Missing player ID');
                return;
            }

            const user = users[id];
            if (!user) {
                console.warn('Unknown player:', id);
                return;
            }

            const message = {
                type: 'chat-message',
                room,
                from: user.name,
                text
            };

            const messageStr = JSON.stringify(message);
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(messageStr);
                }
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