const socket = new WebSocket(`ws://${location.host}`);

const clientId = sessionStorage.getItem('clientId') || crypto.randomUUID();
sessionStorage.setItem('clientId', clientId);

let userListCallback = () => {};

socket.addEventListener('open', () => {
  console.log('Connected to WebSocket server');
});

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.type === 'user-list') {
    userListCallback(data.users);
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

export function onUserListUpdate(callback) {
  userListCallback = callback;
}
