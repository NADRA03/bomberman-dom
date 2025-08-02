// NOTE: Requires your mini-framework.js (StateManager, ViewRenderer, GameLoop, NetworkManager)

import {
  sendMovement,
  onOtherPlayerMove,
  onExistingPlayers,
  getClientId,
  requestMap,
  onMapData,
  sendBomb,
  onBombPlaced,
  onPlayerDisconnect,
  onSpawnPosition,
  onAnySpawnPosition,
  sendStartGame
} from './wsConnect.js';

import { StateManager, ViewRenderer, GameLoop } from './mini-framework.js';

const state = new StateManager({
  bomber: {
    x: 1,
    y: 1,
    size: 40,
    speed: 1,
    movingUp: false,
    movingDown: false,
    movingLeft: false,
    movingRight: false
  },
  remotePlayers: {},
  grid: [],
  bombs: [],
  fires: [],
  lives: 3,
  gridSize: 40,
  mapWidth: 15,
  mapHeight: 13,
  images: {
    fixed: 'frontend/img/solid.png',
    random: 'frontend/img/block.png'
  },
  container: null,
  bomberElement: null,
  heartContainer: null
});

const view = new ViewRenderer('#game-root');

export function startGame(container) {
  state.setState({ container });
  requestMap(); 

  onSpawnPosition(({ x, y }) => {
    const s = state.getState();
    state.setState({
      ...s,
      bomber: { ...s.bomber, x, y }
    });
    sendMovement(x, y);
    update();
  });

  onAnySpawnPosition(({ id, x, y }) => {
    renderRemotePlayer({ id, x, y });
  });

  onMapData(grid => {
    state.setState({ grid });
    drawWalls();
    drawHearts();

    const spawnX = 1;
    const spawnY = 1;
    if (grid[spawnY][spawnX] !== 0) {
      console.warn('Spawn blocked, clearing cell...');
      grid[spawnY][spawnX] = 0;
    }

    state.setState(s => ({
      ...s,
      bomber: { ...s.bomber, x: spawnX, y: spawnY }
    }));

    sendStartGame(); 
    update();
  });

  onOtherPlayerMove(renderRemotePlayer);
  onExistingPlayers(players => {
    players.forEach(renderRemotePlayer);
  });

  onPlayerDisconnect(id => {
    const s = state.getState();
    const newRemotePlayers = { ...s.remotePlayers };

    const player = newRemotePlayers[id];
    if (player) {
      player.element.remove();
      delete newRemotePlayers[id];

      state.setState({
        ...s,
        remotePlayers: newRemotePlayers
      });
    }
  });

  onBombPlaced(({ x, y }) => {
    const s = state.getState();

    const bomb = {
      x,
      y,
      timer: 2000
    };

    const el = view.el('div', {
      className: 'bomb',
      style: {
        position: 'absolute',
        width: `${s.gridSize}px`,
        height: `${s.gridSize}px`,
        left: `${x * s.gridSize}px`,
        top: `${y * s.gridSize}px`,
        backgroundImage: "url('frontend/img/bomb.png')",
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        zIndex: 2
      }
    });

    s.container.appendChild(el);
    bomb.element = el;
    s.bombs.push(bomb);

    setTimeout(() => explodeBomb(bomb), bomb.timer);
  });

  const loop = new GameLoop(update, () => {}, 60);
  loop.start();
}

function drawHearts() {
  const s = state.getState();
  if (s.heartContainer) s.heartContainer.remove();

  const container = view.el('div', {
    style: {
        position: 'fixed',
        top: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '5px',
        zIndex: 1000,
        pointerEvents: 'none'
    }
  });

  for (let i = 0; i < s.lives; i++) {
    const heart = view.el('img', {
      src: 'frontend/img/heart.png',
      style: {
        width: '30px',
        height: '30px'
      }
    });
    container.appendChild(heart);
  }

  document.body.appendChild(container);
  state.setState({ heartContainer: container });
}

function update() {
  const s = state.getState();
  const { bomber, gridSize, container } = s;

  if (!s.bomberElement) {
    const el = view.el('div', {
      id: 'bomber',
      style: {
        position: 'absolute',
        width: `${gridSize}px`,
        height: `${gridSize}px`,
        backgroundImage: "url('frontend/img/bomber.png')",
        backgroundSize: 'contain',
        zIndex: 1
      }
    });
    container.appendChild(el);
    state.setState({ bomberElement: el });
  }

  s.bomberElement.style.left = `${bomber.x * gridSize}px`;
  s.bomberElement.style.top = `${bomber.y * gridSize}px`;
}

function renderRemotePlayer({ id, x, y }) {
  if (id === getClientId()) return;

  const s = state.getState();
  if (!s.remotePlayers[id]) {
    const el = view.el('div', {
      className: 'remote-player',
      style: {
        position: 'absolute',
        width: `${s.gridSize}px`,
        height: `${s.gridSize}px`,
        backgroundImage: "url('frontend/img/bomber.png')",
        backgroundSize: 'contain',
        zIndex: 1
      }
    });
    s.container.appendChild(el);
    s.remotePlayers[id] = { x, y, element: el };
  }

  const player = s.remotePlayers[id];
  player.x = x;
  player.y = y;
  player.element.style.left = `${x * s.gridSize}px`;
  player.element.style.top = `${y * s.gridSize}px`;

}

function drawWalls() {
  const { grid, gridSize, images, container } = state.getState();
  document.querySelectorAll('.tile').forEach(el => el.remove());

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 0) return;
      const tile = view.el('div', {
        className: 'tile',
        style: {
          position: 'absolute',
          width: `${gridSize}px`,
          height: `${gridSize}px`,
          left: `${x * gridSize}px`,
          top: `${y * gridSize}px`,
          backgroundImage: `url('${cell === 2 ? images.fixed : images.random}')`,
          backgroundSize: 'cover',
          zIndex: 0
        }
      });
      container.appendChild(tile);
    });
  });
}

function placeBomb() {
  const s = state.getState();
  const { bomber, bombs, gridSize, container } = s;

  if (bombs.some(b => b.x === bomber.x && b.y === bomber.y)) return;

  const bomb = {
    x: bomber.x,
    y: bomber.y,
    timer: 2000
  };

  const el = view.el('div', {
    className: 'bomb',
    style: {
      position: 'absolute',
      width: `${gridSize}px`,
      height: `${gridSize}px`,
      left: `${bomb.x * gridSize}px`,
      top: `${bomb.y * gridSize}px`,
      backgroundImage: "url('frontend/img/bomb.png')",
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      zIndex: 2
    }
  });

  container.appendChild(el);
  bomb.element = el;
  bombs.push(bomb);
  sendBomb(bomb.x, bomb.y);
  setTimeout(() => explodeBomb(bomb), bomb.timer);
}

function explodeBomb(bomb) {
  const s = state.getState();
  const { gridSize, bombs, fires, grid, container, bomber } = s;

  bomb.element.remove();
  s.bombs = bombs.filter(b => b !== bomb);

  const directions = [ [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1] ];

  directions.forEach(([dx, dy]) => {
    const fx = bomb.x + dx;
    const fy = bomb.y + dy;
    if (fx < 0 || fx >= s.mapWidth || fy < 0 || fy >= s.mapHeight) return;
    if (grid[fy][fx] === 2) return;
    if (grid[fy][fx] === 1) grid[fy][fx] = 0;

    const fire = view.el('div', {
      className: 'fire',
      style: {
        position: 'absolute',
        width: `${gridSize}px`,
        height: `${gridSize}px`,
        left: `${fx * gridSize}px`,
        top: `${fy * gridSize}px`,
        backgroundImage: "url('frontend/img/fire.png')",
        backgroundSize: 'contain',
        zIndex: 1
      }
    });

    container.appendChild(fire);
    fires.push(fire);

    if (bomber.x === fx && bomber.y === fy && s.lives > 0) {
    const newLives = s.lives - 1;
    state.setState({
        ...s,
        lives: newLives,
        bomber: { ...bomber, x: 1, y: 1 }
    });
    drawHearts();
    sendMovement(1, 1);
    update();
    }

    setTimeout(() => {
      fire.remove();
      state.setState({ fires: fires.filter(f => f !== fire) });
      drawWalls();
    }, 400);
  });
}

document.addEventListener('keydown', e => {
  const s = state.getState();
  const { bomber, grid, mapWidth, mapHeight } = s;
  let nextX = bomber.x;
  let nextY = bomber.y;

  if (e.key === 'ArrowUp') nextY--;
  else if (e.key === 'ArrowDown') nextY++;
  else if (e.key === 'ArrowLeft') nextX--;
  else if (e.key === 'ArrowRight') nextX++;
  else if (e.code === 'Space') return placeBomb();
  else return;

  if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;
  const cell = grid[nextY][nextX];
  if (cell === 1 || cell === 2) return;

  bomber.x = nextX;
  bomber.y = nextY;

  update();
  sendMovement(nextX, nextY);
});

document.addEventListener('keyup', e => {
  const b = state.getState().bomber;
  if (e.key === 'ArrowUp') b.movingUp = false;
  if (e.key === 'ArrowDown') b.movingDown = false;
  if (e.key === 'ArrowLeft') b.movingLeft = false;
  if (e.key === 'ArrowRight') b.movingRight = false;
});







