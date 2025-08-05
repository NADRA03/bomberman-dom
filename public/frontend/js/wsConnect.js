const clientId = sessionStorage.getItem('clientId') || crypto.randomUUID();
sessionStorage.setItem('clientId', clientId);

document.cookie = `player_id=${clientId}; path=/`;

const socket = new WebSocket(`ws://${location.host}`);

let userListCallback = () => {};
let movementCallback = () => {};
let spawnCallback = () => {};
let existingPlayersCallback = () => {};
let otherSpawnCallback = () => {};
let mapCallback = () => {};
let bombCallback = () => {};

let chatCallback = null;


socket.addEventListener('open', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Client ID:', clientId);       
  console.log('Cookie set:', document.cookie);
});

socket.addEventListener('close', (event) => {
  console.log('❌ WebSocket closed:', event.code, event.reason);
  setTimeout(() => {
    console.log('🔄 Attempting to reconnect...');
    location.reload();
  }, 2000);
});

socket.addEventListener('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  console.log('[WS] Received:', data);

  switch (data.type) {
    case 'user-list':
      userListCallback(data.users);
      break;

    case 'player-move':
      if (data.id === clientId) {
        spawnCallback({ x: data.x, y: data.y });
      } else {
        movementCallback(data);
      }
      break;

    case 'spawn-position':
      if (data.id === clientId) {
        spawnCallback({ x: data.x, y: data.y });
      } else {
        otherSpawnCallback(data);
      }
      break;

    case 'existing-players':
      existingPlayersCallback(data.players);
      break;

    case 'map-data':
      mapCallback(data.grid);
      break;

    case 'bomb':
      console.log('[WS] Bomb placed at:', data.x, data.y);
      bombCallback({ x: data.x, y: data.y });
      break;

    case 'error':
      console.error('[WS] Error:', data.message);
      if (data.message !== 'Missing player_id cookie') {
        alert(data.message);
      }
      break;

    case 'chat-message':
      if (chatCallback) chatCallback(data);
      break;


    default:
      console.warn('[WS] Unknown message type:', data);
  }
});

export function sendUsername(username, id) {
  const payload = {
    type: 'new-user',
    id: clientId,
    name: username
  };

  const send = () => socket.send(JSON.stringify(payload));
  if (socket.readyState === WebSocket.OPEN) send();
  else socket.addEventListener('open', send, { once: true });
}

export function sendMovement(x, y) {
  const payload = {
    type: 'player-move',
    id: clientId,
    x,
    y
  };
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export function sendBomb(x, y) {
  console.log("sending bommb")
  const payload = {
    type: 'bomb',
    id: clientId,
    x,
    y
  };
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export function onBombPlaced(callback) {
  bombCallback = callback;
}

export function onUserListUpdate(callback) {
  userListCallback = callback;
}

export function onOtherPlayerMove(callback) {
  movementCallback = callback;
}

export function onSpawnPosition(callback) {
  spawnCallback = callback;
}

export function onExistingPlayers(callback) {
  existingPlayersCallback = callback;
}

export function onAnySpawnPosition(callback) {
  otherSpawnCallback = callback;
}

export function onMapData(callback) {
  mapCallback = callback;
}

export function onChatMessage(callback) {
  chatCallback = callback;
}

export function sendChatMessage({ id, room, text }) {
  const payload = {
    type: 'chat-message',
    payload: { id: clientId, room, text }
  };
  console.log('Sending chat message with ID:', clientId);
  
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  } else {
    console.error('❌ Cannot send chat message: WebSocket not open, state:', socket.readyState);
  }
}

export const getClientId = () => clientId;

export function requestMap() {
  const payload = { type: 'request-map' };
  const send = () => {
    socket.send(JSON.stringify(payload));
  };

  if (socket.readyState === WebSocket.OPEN) {
    send();
  } else {
    socket.addEventListener('open', send, { once: true });
  }
}







