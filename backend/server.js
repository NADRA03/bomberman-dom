import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const users = {};
const takenSpawns = new Map();

const mapWidth = 15;
const mapHeight = 13;
const spawnPoints = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 1, y: 11 },
  { x: 13, y: 11 }
];

const mapData = generateMapData(mapWidth, mapHeight);

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

wss.on('connection', (ws) => {
  // Send map data on connection
  ws.send(JSON.stringify({
    type: 'map-data',
    grid: mapData
  }));

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      console.error('Invalid JSON:', msg);
      return;
    }

    if (data.type === 'request-map') {
      console.log("sending mapData");
      ws.send(JSON.stringify({
        type: 'map-data',
        grid: mapData
      }));
    }

    // Handle new user connection
    if (data.type === 'new-user') {
      if (takenSpawns.has(data.id)) {
        takenSpawns.delete(data.id);
      }

      const spawn = getAvailableSpawn();
      if (!spawn) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game full' }));
        return;
      }

      users[data.id] = {
        id: data.id,
        name: data.name,
        ws,
        x: spawn.x,
        y: spawn.y
      };
      takenSpawns.set(data.id, spawn);

      // Send all existing players to new user
      const others = Object.values(users)
        .filter(u => u.id !== data.id)
        .map(u => ({ id: u.id, name: u.name, x: u.x, y: u.y }));

      if (others.length > 0) {
        ws.send(JSON.stringify({
          type: 'existing-players',
          players: others
        }));
      }

      // Send spawn-position to the new user (for their own position)
      ws.send(JSON.stringify({
        type: 'spawn-position',
        id: data.id,
        x: spawn.x,
        y: spawn.y
      }));

      // Broadcast spawn-position to others
      broadcast('spawn-position', {
        id: data.id,
        x: spawn.x,
        y: spawn.y
      });

      // Update user list
      broadcast('user-list', {
        users: Object.values(users).map(u => u.name)
      });
    }

    // Handle movement
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
    }
  });

  ws.on('close', () => {
    const userEntry = Object.entries(users).find(([id, u]) => u.ws === ws);
    if (userEntry) {
      const [id] = userEntry;
      takenSpawns.delete(id);
      delete users[id];

      broadcast('user-list', {
        users: Object.values(users).map(u => u.name)
      });
    }
  });
});

app.use(express.static(path.join(__dirname, '../public')));

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`✅ HTTP + WS server running at http://localhost:${PORT}`);
});


