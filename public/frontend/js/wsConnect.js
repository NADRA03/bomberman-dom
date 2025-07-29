const socket = new WebSocket(`ws://${location.host}`);

const clientId = sessionStorage.getItem('clientId') || crypto.randomUUID();
sessionStorage.setItem('clientId', clientId);

let userListCallback = () => {};
let movementCallback = () => {};
let spawnCallback = () => {};
let existingPlayersCallback = () => {};
let otherSpawnCallback = () => {};
let mapCallback = () => {};

socket.addEventListener('open', () => {
  console.log('✅ Connected to WebSocket server');
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

    case 'error':
      console.error('[WS] Error:', data.message);
      alert(data.message);
      break;

    default:
      console.warn('[WS] Unknown message type:', data);
  }
});

export function sendUsername(username) {
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





