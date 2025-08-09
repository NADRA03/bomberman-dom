import { StateManager, Router, ViewRenderer } from './mini-framework.js';
import { sendUsername, onUserListUpdate, getClientId } from './wsConnect.js';

const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

const stateManager = new StateManager({
  devMode: true,
  playerName: '',
  users: [],
  countdown: null,
  userRegistered: false,
  routePermission: {
    lobby: false,
    play: false
  }
});

const view = new ViewRenderer('#app');

const renderApp = (state, el) => {
  const path = window.location.hash.slice(1) || '';

  console.log('Current route:', path, 'User registered:', state.userRegistered);

  if (path === '') return renderNameForm(stateManager, el);  

  if (path === 'lobby') {
    if (state.routePermission.lobby || state.devMode) return renderLobby(stateManager, el);
    return renderNotFound(el);
  }

  if (path === 'play') {
    if (state.routePermission.play || state.devMode) return renderPlay(stateManager, el);
    return renderNotFound(el);
  }

  return renderNotFound(el);
};

view.mount(stateManager, renderApp);

const router = new Router();
router.handleRoute();
window.addEventListener('hashchange', () => router.handleRoute());

function renderNameForm(sm, el) {
  return el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '1rem'
    }
  },
    el('h1', {}, 'Enter Your Name'),
    el('input', {
      id: 'player-name',
      placeholder: 'Your name',
      bind: 'playerName',
      style: {
        padding: '0.5rem',
        fontSize: '1rem',
        textAlign: 'center'
      }
    }),
    el('button', {
      onclick: () => {
        const name = sm.getState().playerName.trim() || 'Player';
        sm.setState({
          playerName: name,
          routePermission: { lobby: true, play: false }
        });

        const id = getClientId();
        console.log('Registering user:', name, 'with ID:', id);

        sm.setState({ userRegistered: true });

        localStorage.setItem('playerName', name);
        sendUsername(name, id);
        window.location.hash = '#lobby';
      },
      style: {
        padding: '0.5rem 1rem',
        fontSize: '1rem',
        cursor: 'pointer'
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
          sm.setState(s => ({
            ...s,
            routePermission: { ...s.routePermission, play: true }
          }));
          window.location.hash = '#play';
        }
      }, 1000);
    }

    if (users.length < 2 && sm.getState().countdown != null) {
      sm.setState({ countdown: null });
    }
  });

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
      state.users.map(u =>
        el('li', {}, `${u.name} (${u.status}) - ${u.color}`)
      )
    ),
    el('p', {}, state.countdown != null ? `Game starting in ${state.countdown}...` : ''),
    el('button', {
      onclick: () => {
        sm.setState(s => ({
          ...s,
          routePermission: { ...s.routePermission, play: true }
        }));
        window.location.hash = '#play';
      }
    }, 'Start Game'),
  ),
    el('aside', { id: 'chat-root', className: 'chat-container' })
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

    const chatRoot = document.getElementById('chat-root');
    if (chatRoot) import('./chat.js').then(mod => mod.initChat('#chat-root', 'game'));
  }, 0);

  return el('div', { className: 'page-wrapper' },
    el('div', { id: 'game-root' }),
    el('div', { id: 'chat-root', className: 'chat-container' })
  );
}

function renderNotFound(el) {
  return el('div', {},
    el('h1', {}, '404 Not Found'),
  );
}
