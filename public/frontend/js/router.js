import { StateManager, Router, ViewRenderer } from './mini-framework.js';
import { sendUsername, onUserListUpdate, getClientId } from './wsConnect.js';

// Create the app container
const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

// Initialize state manager
const stateManager = new StateManager({
  playerName: '',
  users: [],
  countdown: null,
  userRegistered: false,
});

const view = new ViewRenderer('#app');

// Top-level render dispatcher
const renderApp = (state, el) => {
  const path = window.location.hash.slice(1) || '';
  
  console.log('🔍 Current route:', path, 'User registered:', state.userRegistered);
  
  if (path === '') return renderNameForm(stateManager, el);
  if (path === 'lobby') {
    if (!state.userRegistered) {
      console.log(' User not registered, redirecting to name form');
      window.location.hash = '';
      return renderNameForm(stateManager, el);
    }
    return renderLobby(stateManager, el);
  }
  if (path === 'play') {
    if (!state.userRegistered) {
      console.log(' User not registered, redirecting to name form');
      window.location.hash = '';
      return renderNameForm(stateManager, el);
    }
    return renderPlay(stateManager, el);
  }
  return renderNotFound(el);
};

view.mount(stateManager, renderApp);

// Router setup
const router = new Router();
router.handleRoute();
window.addEventListener('hashchange', () => router.handleRoute());

// Views

function renderNameForm(sm, el) {
  return el('div', {},
    el('h1', {}, 'Enter Your Name'),
    el('input', {
      id: 'player-name',
      placeholder: 'Your name',
      bind: 'playerName',
    }),
    el('button', {
      onclick: () => {
        const name = sm.getState().playerName.trim() || 'Player';
        sm.setState({ playerName: name });
        
        const id = getClientId();
        console.log('Registering user:', name, 'with ID:', id);
        
        sm.setState({ userRegistered: true });
        
        sendUsername(name, id);
        window.location.hash = '#lobby';
      }
    }, 'Enter Lobby')
  );
}

function renderLobby(sm, el) {
  const state = sm.getState();

  // Countdown and user list update (triggered once from WebSocket)
  onUserListUpdate(users => {
    console.log(' User list updated:', users);
    sm.setState({ users });

    if (users.length >= 2 && sm.getState().countdown == null) {
      let seconds = 5;
      sm.setState({ countdown: seconds });

      const timer = setInterval(() => {
        seconds--;
        sm.setState({ countdown: seconds });
        if (seconds <= 0) {
          clearInterval(timer);
          window.location.hash = '#play';
        }
      }, 1000);
    }

    if (users.length < 2 && sm.getState().countdown != null) {
      sm.setState({ countdown: null });
    }
  });

  // Initialize chat module once container is in DOM
  setTimeout(() => {
    const chatRoot = document.getElementById('chat-root');
    if (chatRoot) {
      import('./chat.js').then(mod => mod.initChat('#chat-root', 'lobby'));
    }
  }, 0);

  return el('div', { className: 'page-wrapper' },
    el('div', { className: 'lobby-content' },
      el('h1', {}, 'Lobby'),
      el('p', {}, 'Welcome, ', el('strong', {}, state.playerName)),
      el('h1', {}, 'Connected Players:'),
      el('ul', {},
        state.users.map(u => el('li', {}, u))
      ),
      el('p', {}, state.countdown != null ? `Game starting in ${state.countdown}...` : ''),
      el('button', {
        onclick: () => {
          window.location.hash = '#play';
        }
      }, 'Start Game')
    ),
    el('div', { id: 'chat-root', className: 'chat-container' })
  );
}

function renderPlay(sm, el) {
  setTimeout(() => {
    const gameRoot = document.getElementById('game-root');
    if (gameRoot) import('./bomberman.js').then(mod => mod.startGame(gameRoot));

    const chatRoot = document.getElementById('chat-root');
    if (chatRoot) import('./chat.js').then(mod => mod.initChat('#chat-root', 'game'));
  }, 0);

  return el('div', { className: 'page-wrapper' },
    el('div', { id: 'game-root', className: 'game-area' }),
    el('div', { id: 'chat-root', className: 'chat-container' })
  );
}

function renderNotFound(el) {
  return el('div', {},
    el('h1', {}, '404 Not Found'),
    el('a', { href: '#'}, 'Go to Home')
  );
}
