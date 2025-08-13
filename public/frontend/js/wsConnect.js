const clientId = sessionStorage.getItem('clientId') || 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
sessionStorage.setItem('clientId', clientId);

document.cookie = `player_id=${clientId}; path=/`;

export const socket = new WebSocket(`ws://${location.host}`);

let userListCallback = () => { };
let movementCallback = () => { };
let spawnCallback = () => { };
let existingPlayersCallback = () => { };
let otherSpawnCallback = () => { };
let mapCallback = () => { };
let bombCallback = () => { };

let powerupSpawnCallback = () => { };
let powerupPickedCallback = () => { };
let chatCallback = null;

// --- Updated for multiple disconnect callbacks ---
const disconnectCallbacks = [];

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
            movementCallback(data);
            break;

        case 'spawn-position':
            if (data.id === clientId) spawnCallback({ x: data.x, y: data.y, color: data.color });
            else otherSpawnCallback(data);
            break;

        case 'existing-players':
            existingPlayersCallback(data.players);
            break;

        case 'map-data':
            mapCallback(data.grid);
            break;

        case 'bomb':
            bombCallback({ id: data.id, x: data.x, y: data.y });
            break;

        case 'powerup-spawn':
            powerupSpawnCallback(data.powerup);
            break;

        case 'powerup-picked':
            powerupPickedCallback({
                id: data.id,
                by: data.by,
                type: data.powerupType,
                newMaxBombs: data.newMaxBombs,
                newFlameRange: data.newFlameRange,
                newMoveIntervalMs: data.newMoveIntervalMs,
                newSpeedLevel: data.newSpeedLevel
            });
            break;

        case 'player-disconnect':
            disconnectCallbacks.forEach(cb => cb(data.id));
            break;

        case 'chat-message':
            if (chatCallback) chatCallback(data);
            break;

        case 'error':
            console.error('[WS] Error:', data.message);
            alert(data.message);
            if (data.message.includes('Lobby is full')) window.location.hash = '#';
            break;

        default:
            console.warn('[WS] Unknown message type:', data);
    }
});

// === Outbound Messages ===
export function sendUsername(username) {
    const payload = { type: 'new-user', id: clientId, name: username };
    const send = () => socket.send(JSON.stringify(payload));
    socket.readyState === WebSocket.OPEN ? send() : socket.addEventListener('open', send, { once: true });
}

export function sendStartGame() {
    const payload = { type: 'start-game', id: clientId };
    const send = () => socket.send(JSON.stringify(payload));
    socket.readyState === WebSocket.OPEN ? send() : socket.addEventListener('open', send, { once: true });
}

export function sendMovement(x, y) {
    const payload = { type: 'player-move', id: clientId, x, y };
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

export function sendBomb(x, y) {
    const payload = { type: 'bomb', id: clientId, x, y };
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

// === Event Hooks ===
export function onBombPlaced(callback) { bombCallback = callback; }
export function onUserListUpdate(callback) { userListCallback = callback; }
export function onOtherPlayerMove(callback) { movementCallback = callback; }
export function onSpawnPosition(callback) { spawnCallback = callback; }
export function onAnySpawnPosition(callback) { otherSpawnCallback = callback; }
export function onExistingPlayers(callback) { existingPlayersCallback = callback; }
export function onMapData(callback) { mapCallback = callback; }

// --- Updated for multiple disconnects ---
export function onPlayerDisconnect(callback) {
    if (typeof callback === 'function') disconnectCallbacks.push(callback);
}

export function onChatMessage(callback) { chatCallback = callback; }
export function onPowerupSpawn(callback) { powerupSpawnCallback = callback; }
export function onPowerupPicked(callback) { powerupPickedCallback = callback; }

// === Utility ===
export const getClientId = () => clientId;

export function sendPickupPowerup(powerupId) {
    const payload = { type: 'pickup-powerup', id: clientId, powerupId };
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

export function requestMap() {
    const payload = { type: 'request-map' };
    const send = () => socket.send(JSON.stringify(payload));
    socket.readyState === WebSocket.OPEN ? send() : socket.addEventListener('open', send, { once: true });
}

export function sendChatMessage({ id, room, text }) {
    const payload = { type: 'chat-message', payload: { id: clientId, room, text } };
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

export function sendRespawn() {
    const payload = { type: 'respawn', id: clientId };
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
