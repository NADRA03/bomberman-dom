import { StateManager, Router, ViewRenderer } from './mini-framework.js';
import { sendUsername, onUserListUpdate, getClientId } from './wsConnect.js';
import { onPlayerDisconnect, socket } from './wsConnect.js';

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
    lobby: true,
    play: true
  }
});

const view = new ViewRenderer('#app');

const renderApp = (state, el) => {
  const path = window.location.hash.slice(1) || '';

  console.log('Current route:', path, 'User registered:', state.userRegistered);

  // --- Route guard: redirect to root if not registered ---
  if (!state.userRegistered && path !== '') {
    window.location.hash = '#';   // go to root
    return renderNameForm(stateManager, el);
  }

  if (path === '') return renderNameForm(stateManager, el);

  if (path === 'lobby') {
    if (state.routePermission.lobby || state.devMode) return renderLobby(stateManager, el);
    return renderNotFound(el);
  }

  if (path === 'play') {
    if (state.routePermission.play || state.devMode) return renderPlay(stateManager, el, router);
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
            const id = getClientId();

            // Step 1: Ask server if joining is allowed
            socket.send(JSON.stringify({ type: 'check-join' }));

            const handleServer = (event) => {
              const data = JSON.parse(event.data);

              if (data.type === 'check-join-response') {
                if (!data.allowed) {
                  alert(data.message || 'Game in progress. Please wait.');
                } else {
                  // Step 2: Register user only if allowed
                  socket.send(JSON.stringify({ type: 'new-user', id, name }));
                  sm.setState({
                    playerName: name,
                    routePermission: { lobby: true, play: false },
                    userRegistered: true
                  });
                  localStorage.setItem('playerName', name);
                  window.location.hash = '#lobby';
                }

                socket.removeEventListener('message', handleServer);
              }
            };

            socket.addEventListener('message', handleServer);
          },
          style: { padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer' }
        }, 'Enter Lobby')
      )
    ),
  );
}




function renderLobby(sm, el) {
  const state = sm.getState();

  let waitTimer = null;       // 20-second wait timer
  let readyTimer = null;      // 10-second ready countdown

  onUserListUpdate(users => {
    sm.setState({ users });
    const numPlayers = users.length;

    // 2-3 players: start 20-second wait timer if not running
    if (numPlayers >= 2 && numPlayers < 4 && waitTimer == null && readyTimer == null) {
      let waitSeconds = 3;  /////////////////////////developer
      updateCountdown(waitSeconds, 'Waiting for more players...');
      waitTimer = setInterval(() => {
        waitSeconds--;
        updateCountdown(waitSeconds, 'Waiting for more players...');
        if (waitSeconds <= 0) {
          clearInterval(waitTimer);
          waitTimer = null;
          startReadyCountdown();
        }
      }, 1000);
    }

    // 4 players: skip wait, start ready countdown immediately
    if (numPlayers === 4 && readyTimer == null) {
      if (waitTimer) {
        clearInterval(waitTimer);
        waitTimer = null;
      }
      startReadyCountdown();
    }

    // Reset if players < 2
    if (numPlayers < 2) {
      if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
      if (readyTimer) { clearInterval(readyTimer); readyTimer = null; }
      updateCountdown(null);
    }
  });

  function startReadyCountdown() {
    let countdown = 3;    /////////////////////////developer
    updateCountdown(countdown, 'Get ready!');
    readyTimer = setInterval(() => {
      countdown--;
      updateCountdown(countdown, 'Get ready!');
      if (countdown <= 0) {
        clearInterval(readyTimer);
        readyTimer = null;
        sm.setState(s => ({
          ...s,
          routePermission: { ...s.routePermission, play: true }
        }));
        window.location.hash = '#play';
      }
    }, 1000);
  }

  function updateCountdown(seconds, prefix = '') {
    const el = document.getElementById('countdown-text');
    if (el) el.textContent = seconds != null ? `${prefix} ${seconds}...` : '';
  }

  // Initialize chat
  setTimeout(() => {
    const chatRoot = document.getElementById('chat-root');
    if (chatRoot) import('./chat.js').then(mod => mod.initChat('#chat-root', 'lobby'));
  }, 0);

  return el('div', {
    className: 'page-wrapper',
    style: { display: 'flex', width: '100%', maxWidth: '1200px', margin: '0 auto', height: '100vh', position: 'relative' }
  },

  el('h1', {
    style: {
      margin: 0,
      position: 'absolute',
      color: 'yellow',
      fontSize: '100px',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      opacity: 0.7,
      pointerEvents: 'none',
      zIndex: 2,
      userSelect: 'none',
      textShadow: '2px 2px 4px rgba(0,0,0,1)'
    }
  }, 'BOMBERMEN'),

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
      height: '100vh'
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
      zIndex: 0
    }
  }),

  el('div', { style: { position: 'relative', zIndex: 1 } },
    el('h1', {}, 'Connected Players:'),
    el('ul', {},
      state.users.map(u =>
        el('li', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' } },
          el('img', {
            src: `frontend/img/${u.color || 'blue'}/front.png`,
            alt: u.color || 'player',
            style: { width: '50px', height: '50px', imageRendering: 'pixelated' }
          }),
          el('span', {}, `${u.name} (${u.status})`)
        )
      )
    ),
    el('p', { id: 'countdown-text' }, '')
  )),

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
      boxSizing: 'border-box'
    }
  })
  );
}


function renderPlay(sm, el, router) {
  // Keep the player list in sync
  onUserListUpdate(users => {
    sm.setState({ users });
  });

  // Disconnect handler
  onPlayerDisconnect(id => {
    const s = sm.getState();
    if (!Array.isArray(s.users)) return;

    const updatedUsers = s.users.map(u =>
      u.id === id ? { ...u, disconnected: true } : u
    );

    sm.setState({ ...s, users: updatedUsers });
    console.log('Player disconnected:', id, 'Updated users:', updatedUsers);

    // Check if only local player remains
    const activePlayers = updatedUsers.filter(u => !u.disconnected && u.id !== getClientId());
    if (activePlayers.length === 0) {
      blockAllInput();
      showWinToast();
      disconnectPlayer();
    }
  });

  // Load game and chat
  setTimeout(() => {
    const container = document.getElementById('game-root');
    if (container) import('./bomberman.js').then(mod => mod.startGame(container));

    const chatRoot = document.getElementById('chat-root');
    if (chatRoot) import('./chat.js').then(mod => mod.initChat('#chat-root', 'game'));
  }, 0);

  const state = sm.getState();

  return el('div', {
    className: 'page-wrapper',
    style: { display: 'flex', height: '100vh', maxWidth: '1200px', margin: '0 auto' }
  },
    // LEFT: Player list
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
      el('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } },
        (state.users || []).map(u =>
          el('li', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
              color: u.disconnected ? 'red' : 'white',
              fontWeight: u.disconnected ? 'bold' : 'normal',
            }
          },
            el('img', {
              src: `frontend/img/${u.color || 'blue'}/front.png`,
              alt: u.color || 'player',
              style: {
                width: '50px',
                height: '50px',
                imageRendering: 'pixelated',
                opacity: u.disconnected ? 0.5 : 1
              }
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
    el('div', { id: 'game-root', style: { flex: 3 } }),

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

  // --- Toast helper ---
  function showWinToast() {
    const existing = document.getElementById('win-toast');
    if (existing) return;

    const toastSize = '300px'; // square size

    const toast = el('div', {
      id: 'win-toast',
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: toastSize,
        height: toastSize,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '15px',
        border: '2px solid #fff',
        textAlign: 'center',
        animation: 'fadeIn 0.5s ease-out',
        boxSizing: 'border-box',
      }
    },
      el('img', {
        src: './frontend/img/win.gif',
        alt: 'Victory',
        style: {
          width: '100px',
          height: '100px',
          objectFit: 'contain',
        }
      }),
      el('span', {
        style: {
          fontSize: '1.8rem',
          fontWeight: '900',
          letterSpacing: '2px',
        }
      }, 'Victory!'),
      el('button', {
        onclick: () => {
          window.location.href = '/';
        },
        style: {
          padding: '0.5rem 1rem',
          fontSize: '1rem',
          cursor: 'pointer'
        }
      }, 'Back to Home')
    );

    document.body.appendChild(toast);

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn {
        0% { opacity: 0; transform: translate(-50%, -45%); }
        100% { opacity: 1; transform: translate(-50%, -50%); }
      }
    `;
    document.head.appendChild(style);
  }

  // --- Disconnect the player from the server ---
  function disconnectPlayer() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
      console.log('Player disconnected from server after winning');
    }
  }

  // --- Block all input using overlay ---
  function blockAllInput() {
    const overlay = document.createElement('div');
    overlay.id = 'input-blocker';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 9998, // below toast
      backgroundColor: 'transparent',
    });

    // Block mouse/touch events
    ['click','mousedown','mouseup','touchstart','touchend'].forEach(evt => {
      overlay.addEventListener(evt, e => e.stopPropagation(), true);
    });

    // Block keyboard events
    overlay.tabIndex = 0;
    ['keydown','keyup','keypress'].forEach(evt => {
      overlay.addEventListener(evt, e => e.stopPropagation(), true);
    });

    document.body.appendChild(overlay);
    console.log('All player input blocked');
  }
}

function renderNotFound(el) {
  return el('div', {},
    el('h1', {}, '404 Not Found'),
  );
}
