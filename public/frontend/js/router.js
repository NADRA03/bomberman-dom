import { sendUsername, onUserListUpdate } from './wsConnect.js';

const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

const routes = {
  '': renderNameForm,
  '#': renderNameForm,
  '#lobby': renderLobby,
  '#play': renderPlay
};

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

function router() {
  const hash = window.location.hash;
  const route = routes[hash] || renderNotFound;
  route();
}

function renderNameForm() {
  app.innerHTML = `
    <h1>Enter Your Name</h1>
    <input id="player-name" placeholder="Your name" />
    <button id="connect-btn">Enter Lobby</button>
  `;

  document.getElementById('connect-btn').onclick = () => {
    const name = document.getElementById('player-name').value.trim() || 'Player';
    window.playerName = name;
    sendUsername(name); 
    window.location.hash = '#lobby';
  };
}

function renderLobby() {
  app.innerHTML = `
    <h1>Lobby</h1>
    <p>Welcome, <strong>${window.playerName}</strong></p>
    <h3>Connected Players:</h3>
    <ul id="user-list"></ul>
    <button id="start-game">Start Game</button>
  `;

  document.getElementById('start-game').onclick = () => {
    window.location.hash = '#play';
  };

  onUserListUpdate(users => {
    const ul = document.getElementById('user-list');
    ul.innerHTML = users.map(u => `<li>${u}</li>`).join('');
  });
}

function renderPlay() {
  app.innerHTML = `<div id="game-root"></div>`;
  import('./bomberman.js').then(mod => {
    mod.startGame(document.getElementById('game-root'));
  });
}

function renderNotFound() {
  app.innerHTML = '<h1>404 Not Found</h1><a href="#">Go to Home</a>';
}

