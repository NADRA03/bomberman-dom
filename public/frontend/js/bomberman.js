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
    sendStartGame,
    onPowerupSpawn,
    onPowerupPicked,
    // sendPickupPowerup
} from './wsConnect.js';

import { StateManager, ViewRenderer, GameLoop } from './mini-framework.js';

const state = new StateManager({
    bomber: {
        x: 1,
        y: 1,
        size: 40,
        color: 'blue',
        speed: 1,
        direction: 'down',
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
    heartContainer: null,

    powerups: [],
    stats: { maxBombs: 1 },
});

const view = new ViewRenderer('#game-root');

export function startGame(container) {
    state.setState({ container });
    requestMap();

    onSpawnPosition(({ x, y, color }) => {
        const s = state.getState();
        if (s.bomberElement) s.bomberElement.remove();

        state.setState({
            ...s,
            bomber: {...s.bomber, x, y, color },
            bomberElement: null
        });
        sendMovement(x, y);
        update();
    });

    onAnySpawnPosition(({ id, x, y, color }) => {
        renderRemotePlayer({ id, x, y, color });
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
            bomber: {...s.bomber, x: spawnX, y: spawnY }
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
        const newRemotePlayers = {...s.remotePlayers };

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

    onPowerupSpawn(spawn => {
        const s = state.getState();
        const { gridSize, container, powerups } = s;

        const iconByType = {
            bombs: 'frontend/img/bombPlusOne.png',
        };
        const iconUrl = iconByType[spawn.type] || 'frontend/img/bombPlusOne.png';

        const el = view.el('div', {
            className: `powerup powerup-${spawn.type}`,
            id: `pu-${spawn.id}`,
            style: {
                position: 'absolute',
                width: `${gridSize}px`,
                height: `${gridSize}px`,
                left: `${spawn.x * gridSize}px`,
                top: `${spawn.y * gridSize}px`,
                backgroundImage: `url('${iconUrl}')`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                zIndex: 1
            }
        });

        container.appendChild(el);
        const next = powerups.concat([{...spawn, element: el }]);
        state.setState({ powerups: next });
    });

    onPowerupPicked(({ id, by, type, newMaxBombs }) => {
        const s = state.getState();
        const puIndex = s.powerups.findIndex(p => p.id === id);
        if (puIndex !== -1) {
            s.powerups[puIndex].element?.remove();
            const next = s.powerups.slice();
            next.splice(puIndex, 1);
            state.setState({ powerups: next });
        }

        if (by === getClientId() && type === 'bombs') {
            state.setState({ stats: {...s.stats, maxBombs: newMaxBombs } });
        }
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
    const color = bomber.color || 'blue';

    if (!s.bomberElement) {
        const el = view.el('div', {
            id: 'bomber',
            style: {
                position: 'absolute',
                width: `${gridSize}px`,
                height: `${gridSize}px`,
                backgroundImage: `url('frontend/img/${color}/b-front.png')`,
                backgroundSize: `${gridSize}px ${gridSize}px`,
                imageRendering: 'pixelated',
                backgroundRepeat: 'no-repeat',
                zIndex: 1
            }
        });
        container.appendChild(el);
        state.setState({ bomberElement: el });
    }

    const el = s.bomberElement;
    el.style.left = `${bomber.x * gridSize}px`;
    el.style.top = `${bomber.y * gridSize}px`;

    if (bomber.direction === 'up') {
        el.style.backgroundImage = `url('frontend/img/${color}/b-back.png')`;
        el.style.transform = 'scaleX(1)';
    } else if (bomber.direction === 'down') {
        el.style.backgroundImage = `url('frontend/img/${color}/b-front.png')`;
        el.style.transform = 'scaleX(1)';
    } else if (bomber.direction === 'right') {
        el.style.backgroundImage = `url('frontend/img/${color}/b-side.png')`;
        el.style.transform = 'scaleX(-1)';
    } else if (bomber.direction === 'left') {
        el.style.backgroundImage = `url('frontend/img/${color}/b-side.png')`;
        el.style.transform = 'scaleX(1)';
    }
}

function renderRemotePlayer({ id, x, y, color = 'blue' }) {
    if (id === getClientId()) return;

    const s = state.getState();

    if (!s.remotePlayers[id]) {
        const el = view.el('div', {
            className: 'remote-player',
            style: {
                position: 'absolute',
                width: `${s.gridSize}px`,
                height: `${s.gridSize}px`,
                backgroundImage: `url('frontend/img/${color}/b-front.png')`,
                backgroundSize: `${s.gridSize}px ${s.gridSize}px`,
                imageRendering: 'pixelated',
                backgroundRepeat: 'no-repeat',
                zIndex: 1
            }
        });
        s.container.appendChild(el);
        s.remotePlayers[id] = {
            x,
            y,
            direction: 'down',
            color,
            element: el
        };
    }

    const player = s.remotePlayers[id];

    if (x > player.x) player.direction = 'right';
    else if (x < player.x) player.direction = 'left';
    else if (y > player.y) player.direction = 'down';
    else if (y < player.y) player.direction = 'up';

    player.x = x;
    player.y = y;

    const el = player.element;
    el.style.left = `${x * s.gridSize}px`;
    el.style.top = `${y * s.gridSize}px`;

    const folder = player.color || 'blue';

    if (player.direction === 'up') {
        el.style.backgroundImage = `url('frontend/img/${folder}/b-back.png')`;
        el.style.transform = 'scaleX(1)';
    } else if (player.direction === 'down') {
        el.style.backgroundImage = `url('frontend/img/${folder}/b-front.png')`;
        el.style.transform = 'scaleX(1)';
    } else if (player.direction === 'right') {
        el.style.backgroundImage = `url('frontend/img/${folder}/b-side.png')`;
        el.style.transform = 'scaleX(-1)';
    } else if (player.direction === 'left') {
        el.style.backgroundImage = `url('frontend/img/${folder}/b-side.png')`;
        el.style.transform = 'scaleX(1)';
    }
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
    const { bomber } = s;
    sendBomb(bomber.x, bomber.y);
}

function explodeBomb(bomb) {
    const s = state.getState();
    const { gridSize, bombs, fires, grid, container, bomber } = s;

    bomb.element.remove();
    s.bombs = bombs.filter(b => b !== bomb);

    const directions = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];

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
                bomber: {...bomber, x: 1, y: 1 }
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

function tryPickupPowerup() {
    const s = state.getState();
    const { bomber, powerups } = s;
    const pu = powerups.find(p => p.x === bomber.x && p.y === bomber.y);
    if (!pu) return;

    sendPickupPowerup(pu.id);
}

document.addEventListener('keydown', e => {
    const s = state.getState();
    const { bomber, grid, mapWidth, mapHeight } = s;
    let nextX = bomber.x;
    let nextY = bomber.y;

    if (e.key === 'ArrowUp') {
        nextY--;
        bomber.direction = 'up';
    } else if (e.key === 'ArrowDown') {
        nextY++;
        bomber.direction = 'down';
    } else if (e.key === 'ArrowLeft') {
        nextX--;
        bomber.direction = 'left';
    } else if (e.key === 'ArrowRight') {
        nextX++;
        bomber.direction = 'right';
    } else if (e.code === 'Space') return placeBomb();
    else return;

    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;
    const cell = grid[nextY][nextX];
    if (cell === 1 || cell === 2) return;

    bomber.x = nextX;
    bomber.y = nextY;

    update();
    sendMovement(nextX, nextY);
    // tryPickupPowerup();
});

document.addEventListener('keyup', e => {
    const b = state.getState().bomber;
    if (e.key === 'ArrowUp') b.movingUp = false;
    if (e.key === 'ArrowDown') b.movingDown = false;
    if (e.key === 'ArrowLeft') b.movingLeft = false;
    if (e.key === 'ArrowRight') b.movingRight = false;
});