// backend/server.js
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

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.type === 'new-user') {
      users[data.id] = data.name;

      const payload = JSON.stringify({
        type: 'user-list',
        users: Object.values(users)
      });

      wss.clients.forEach(client => {
        if (client.readyState === ws.OPEN) {
          client.send(payload);
        }
      });
    }
  });

  ws.on('close', () => {
  });
});

app.use(express.static(path.join(__dirname, '../public')));

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`✅ HTTP + WS server running at http://localhost:${PORT}`);
});

