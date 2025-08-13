import { StateManager, Router, ViewRenderer } from './mini-framework.js';
import { sendUsername, onUserListUpdate, getClientId } from './wsConnect.js';
import { onPlayerDisconnect } from './wsConnect.js';

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
      position: 'relative',         
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vh',
      gap: '1rem',
      overflow: 'hidden',                   
    }
  },
  
      el('h1', {
      style: {
        margin: 0,
        position: 'absolute',
        color: 'yellow',
        fontSize: '100px',
        top: '50px',
        opacity: '0.7',
        pointerEvents: 'none',
        zIndex: 2,
        userSelect: 'none',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'  // fully opaque shadow
      }
    }, 'BOMBERMEN'),


    el('div', {
      style: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url("./frontend/img/bg.png")',
        backgroundSize: '80% auto',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        opacity: 0.5,
        pointerEvents: 'none',
        zIndex: 0,
      }
    }),

    el('div', {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        width: '100%',
        height: '100%',
      }
    },

     
      el('img', {
        src: './frontend/img/view.gif',
        alt: 'Logo',
        style: {
          width: '150px',
          height: 'auto',
        }
      }),
      el('h1', {}, 'Enter Your Name'),

      el('div', {
        style: {
          display: 'flex',
          flexDirection: 'row',
          gap: '1rem',
          alignItems: 'center',
        }
      },
        el('input', {
          id: 'player-name',
          placeholder: 'Your name',
          bind: 'playerName',
          style: {
            padding: '0.5rem',
            fontSize: '1rem',
            textAlign: 'center',
            minWidth: '200px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: '2px solid #fff',
            borderRadius: '0',
            imageRendering: 'pixelated',
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
      )
    ),
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

  return el('div', {
    className: 'page-wrapper',
    style: {
      display: 'flex',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative',
    }
  },

  el('div', {
    className: 'lobby-content',
  style: {
    flex: 3,
    padding: '40px 20px',
    marginRight: '340px',
    textAlign: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    backgroundColor: '#000',

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
  }
  },

  el('div', {
    style: {
      position: 'absolute',
      top: '-100px',
      left: '-100px',
      right: '-100px',
      bottom: '-100px',
      backgroundImage: 'url("./frontend/img/bg.png")',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      opacity: 0.5,
      pointerEvents: 'none',
      zIndex: 0,
    }
  }),

  el('div', {
    style: {
      position: 'relative',
      zIndex: 1,
    }
  },
    // el('p', { style: { marginTop: '50%',  color: 'yellow', } }, 'Welcome, ', el('strong', {}, state.playerName)),
    el('h1', {}, 'Connected Players:'),
    el('ul', {},
      state.users.map(u =>
        el('li', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px'
          }
        },
          el('img', {
            src: `frontend/img/${u.color || 'blue'}/front.png`,
            alt: u.color || 'player',
            style: { width: '50px', height: '50px', imageRendering: 'pixelated' }
          }),
          el('span', {}, `${u.name} (${u.status})`)
        )
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
  )
  ),

  el('aside', {
    id: 'chat-root',
    className: 'chat-container',
    style: {
      flex: 1,
      padding: '10px',
      color: '#fff',

      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100vh',
      boxSizing: 'border-box',
    }
  })
  );
}

function renderPlay(sm, el) {
  const state = sm.getState();

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

  return el('div', {
    className: 'page-wrapper',
    style: {
      display: 'flex',
      height: '100vh',
      maxWidth: '1200px',
      margin: '0 auto',
    }
  },

    el('aside', {
      style: {
        padding: '10px',
        color: '#fff',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '50px',
      }
    },
      el('ul', {
        style: {
          listStyle: 'none',
          padding: 0,
          margin: 0
        }
      },
        state.users.map(u =>
          el('li', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
              color: u.disconnected ? 'red' : 'white',
              fontWeight: u.disconnected ? 'bold' : 'normal',
              position: 'relative',
            }
          },
            el('img', {
              src: `frontend/img/${u.color || 'blue'}/front.png`,
              alt: u.color || 'player',
              style: { width: '50px', height: '50px', imageRendering: 'pixelated', opacity: u.disconnected ? 0.5 : 1 }
            }),
            el('span', {}, u.name),
            u.disconnected && el('span', {
              style: {
                color: 'red',
                fontWeight: 'bold',
                marginLeft: '8px',
                fontSize: '24px',
                userSelect: 'none',
              }
            }, 'X')
          )
        )
      )
    ),

    // CENTER: Game root
    el('div', {
      id: 'game-root',
      style: {
        flex: 3,
      }
    }),

    // RIGHT: Chat
    el('div', {
      id: 'chat-root',
      className: 'chat-container',
      style: {
        flex: 1,
        padding: '10px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
        height: '100%',
      }
    })
  );
}

function renderNotFound(el) {
  return el('div', {},
    el('h1', {}, '404 Not Found'),
  );
}

onPlayerDisconnect((id) => {
  console.log(id, " disconnected callback triggered");
  stateManager.setState(state => {
    const updatedUsers = state.users.map(u =>
      u.id === id ? { ...u, disconnected: true } : u
    );
    console.log('Updated users:', updatedUsers);
    return { ...state, users: updatedUsers };
  });
});
