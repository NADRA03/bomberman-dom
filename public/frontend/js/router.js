import { StateManager, Router, ViewRenderer } from './mini-framework.js';
import { sendUsername, onUserListUpdate } from './wsConnect.js';

const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

const stateManager = new StateManager({
  playerName: '',
  users: [],
  countdown: null,
});

const view = new ViewRenderer('#app');


const renderApp = (state, el) => {
  const path = window.location.hash.slice(1) || '';

  if (path === '') return renderNameForm(stateManager, el);
  if (path === 'lobby') return renderLobby(stateManager, el);
  if (path === 'play') return renderPlay(stateManager, el);
  return renderNotFound(el);
};

view.mount(stateManager, renderApp);


const router = new Router();
router.handleRoute();
window.addEventListener('hashchange', () => router.handleRoute());



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
        localStorage.setItem('playerName', name); 
        sendUsername(name);
        window.location.hash = '#lobby';
      }
    }, 'Enter Lobby')
  );
}

function renderLobby(sm, el) {
  const state = sm.getState();


  onUserListUpdate(users => {
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

  return el('div', {},
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
  );
}

function renderPlay(sm, el) {
  setTimeout(() => {
    const container = document.getElementById('game-root');
    if (container) {
      import('./bomberman.js').then(mod => {
        mod.startGame(container);
      });
    }
  }, 0);

  return el('div', {},
    el('div', { id: 'game-root' })
  );
}

function renderNotFound(el) {
  return el('div', {},
    el('h1', {}, '404 Not Found'),
    el('a', { href: '#'}, 'Go to Home')
  );
}
