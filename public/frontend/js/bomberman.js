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
    sendPickupPowerup,
    sendRespawn
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
    mySpawn: null,
    remotePlayers: {},
    remoteStats: {},

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
    powerupContainer: null,
    powerups: [],
    collectedPowerups: [],

    stats: { maxBombs: 1, flameRange: 1, moveIntervalMs: 120, speedLevel: 0 },

    gameTimeLeft: 180 //////////////////developer
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
            bomber: { ...s.bomber, x, y, color },
            mySpawn: { x, y },
            bomberElement: null
        });
        update();
    });

    onAnySpawnPosition(({ id, x, y, color }) => {
        renderRemotePlayer({ id, x, y, color });
    });

    onMapData(grid => {
        state.setState({ grid });
        drawWalls();
        drawHearts();
        drawTimer();

        // const spawnX = 1;
        // const spawnY = 1;
        // if (grid[spawnY][spawnX] !== 0) {
        //     console.warn('Spawn blocked, clearing cell...');
        //     grid[spawnY][spawnX] = 0;
        // }

        // state.setState(s => ({
        //     ...s,
        //     bomber: { ...s.bomber, x: spawnX, y: spawnY }
        // }));

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

    onBombPlaced(({ id, x, y }) => {
        const s = state.getState();

        const ownerId = id;
        const isMine = ownerId === getClientId();
        const ownerRange = isMine
            ? (s.stats.flameRange || 1)
            : (s.remoteStats[ownerId]?.flameRange || 1);

        const bomb = {
            x,
            y,
            range: ownerRange,
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
                backgroundImage: "url('./frontend/img/bomb.png')",
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
            flames: 'frontend/img/flamesPlusOne.png',
            speed: 'frontend/img/speedUp.png'
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
        const next = powerups.concat([{ ...spawn, element: el }]);
        state.setState({ powerups: next });
    });

onPowerupPicked(({ id, by, type, newMaxBombs, newFlameRange, newMoveIntervalMs, newSpeedLevel }) => {
    const s = state.getState();
    const puIndex = s.powerups.findIndex(p => p.id === id);
    if (puIndex !== -1) {
        s.powerups[puIndex].element?.remove();
        const next = s.powerups.slice();
        next.splice(puIndex, 1);
        state.setState({ powerups: next });
    }

    if (by === getClientId()) {
        // Update stats as before
        if (type === 'bombs' && newMaxBombs != null) {
            state.setState({ stats: { ...s.stats, maxBombs: newMaxBombs } });
        }
        if (type === 'flames' && newFlameRange != null) {
            state.setState({ stats: { ...s.stats, flameRange: newFlameRange } });
        }
        if (type === 'speed' && newMoveIntervalMs != null) {
            state.setState({ stats: { ...s.stats, moveIntervalMs: newMoveIntervalMs, speedLevel: newSpeedLevel ?? s.stats.speedLevel } });
        }

        // Make sure powerupContainer exists before appending icon
        if (s.powerupContainer && !s.collectedPowerups.includes(type)) {
            const iconByType = {
                bombs: 'frontend/img/bombPlusOne.png',
                flames: 'frontend/img/flamesPlusOne.png',
                speed: 'frontend/img/speedUp.png'
            };
            const iconUrl = iconByType[type] || 'frontend/img/bombPlusOne.png';
            const icon = view.el('img', {
                src: iconUrl,
                style: { width: '30px', height: '30px' }
            });

            s.powerupContainer.appendChild(icon);

            // Update collectedPowerups immutably
            const newCollected = [...s.collectedPowerups, type];
            state.setState({ collectedPowerups: newCollected });
        }
    } else {
        const curr = s.remoteStats[by] || {};
        const patch = { ...curr };
        if (type === 'bombs' && newMaxBombs != null) patch.maxBombs = newMaxBombs;
        if (type === 'flames' && newFlameRange != null) patch.flameRange = newFlameRange;
        if (type === 'speed' && newMoveIntervalMs != null) {
            patch.moveIntervalMs = newMoveIntervalMs;
            patch.speedLevel = newSpeedLevel ?? curr.speedLevel;
        }
        state.setState({ remoteStats: { ...s.remoteStats, [by]: patch } });
    }
});


    const loop = new GameLoop(() => {
        stepMovement();
        update();
    }, () => { }, 60);

    loop.start();
    startGameTimer();
}

function spritePath(color, pose) {
    return `frontend/img/${color}/${pose}.png`;
}

function drawHearts() {
    const s = state.getState();
    if (s.heartContainer) s.heartContainer.remove();

    // Hearts + powerups container (center top)
    const container = view.el('div', {
        style: {
            position: 'fixed',
            top: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            zIndex: 1000,
            pointerEvents: 'none', // allow clicks to pass through except button
        }
    });

    // Draw hearts
    for (let i = 0; i < s.lives; i++) {
        const heart = view.el('img', {
            src: 'frontend/img/heart.png',
            style: { width: '30px', height: '30px' }
        });
        container.appendChild(heart);
    }

    // Draw powerups
    if (!s.powerupContainer) {
        const powerupWrap = view.el('div', {
            style: {
                display: 'flex',
                gap: '5px',
                marginLeft: '20px'
            }
        });
        container.appendChild(powerupWrap);
        state.setState({ powerupContainer: powerupWrap });
    } else {
        container.appendChild(s.powerupContainer);
    }

    document.body.appendChild(container);
    state.setState({ heartContainer: container });

    // Leave button at top-left
    let leaveBtn = document.getElementById('leave-btn');
    if (!leaveBtn) {
        leaveBtn = view.el('button', {
            id: 'leave-btn',
            onclick: () => {
                window.location.href = '/'; // go back to home
            },
            style: {
                position: 'fixed',
                top: '10px',
                left: '20px',
                zIndex: 1000,
                border: 'none'
            }
        }, 'Leave');

        document.body.appendChild(leaveBtn);
    }
}


function drawTimer() {
    const s = state.getState();
    let timerEl = document.getElementById('game-timer');
    if (!timerEl) {
        timerEl = view.el('div', {
            id: 'game-timer',
            style: {
                position: 'fixed',
                top: '10px',
                right: '20px',
                fontSize: '30px',
                color: '#fff',
                borderRadius: '8px',
                zIndex: 1000
            }
        });
        document.body.appendChild(timerEl);
    }
    const mins = Math.floor(s.gameTimeLeft / 60);
    const secs = s.gameTimeLeft % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

let gameTimerInterval;

function startGameTimer() {
    gameTimerInterval = setInterval(() => {
        const s = state.getState();
        if (s.gameTimeLeft <= 0) {
            clearInterval(gameTimerInterval);  // stop timer here
            endGame();
            return;
        }
        state.setState({ gameTimeLeft: s.gameTimeLeft - 1 });
        drawTimer();
    }, 1000);
}


function endGame() {
    showToast("Time's up! Game over.", 3000);
    setTimeout(() => {
        window.location.href = '/';
    }, 3000);
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
                backgroundImage: `url('frontend/img/${color}/front.png')`,
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
        el.style.backgroundImage = `url('${spritePath(color, 'back')}')`;
        el.style.transform = 'scaleX(1)';
    } else if (bomber.direction === 'down') {
        el.style.backgroundImage = `url('${spritePath(color, 'front')}')`;
        el.style.transform = 'scaleX(1)';
    } else if (bomber.direction === 'right') {
        el.style.backgroundImage = `url('${spritePath(color, 'side')}')`;
        el.style.transform = 'scaleX(-1)';
    } else if (bomber.direction === 'left') {
        el.style.backgroundImage = `url('${spritePath(color, 'side')}')`;
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
                backgroundImage: `url('${spritePath(color, 'front')}')`,
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

    const c = player.color || 'blue';
    if (player.direction === 'up') {
        el.style.backgroundImage = `url('${spritePath(c, 'back')}')`;
        el.style.transform = 'scaleX(1)';
    } else if (player.direction === 'down') {
        el.style.backgroundImage = `url('${spritePath(c, 'front')}')`;
        el.style.transform = 'scaleX(1)';
    } else if (player.direction === 'right') {
        el.style.backgroundImage = `url('${spritePath(c, 'side')}')`;
        el.style.transform = 'scaleX(-1)';
    } else if (player.direction === 'left') {
        el.style.backgroundImage = `url('${spritePath(c, 'side')}')`;
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
    state.setState({ bombs: bombs.filter(b => b !== bomb) });

    const addFire = (fx, fy) => {
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

            state.setState({ ...s, lives: newLives });
            drawHearts();

            const color = s.bomber.color || 'blue';
            const el = s.bomberElement;

            if (el) {
                el.style.backgroundImage = `url('frontend/img/${color}/hit.png')`;
            }

            // Delay before respawn or game over so hit image shows
            setTimeout(() => {
                if (newLives <= 0) {
                    handleGameOver();
                } else {
                    sendRespawn();
                }
            }, 500); // 500ms delay for hit animation
        }

        setTimeout(() => {
            fire.remove();
            state.setState({ fires: fires.filter(f => f !== fire) });
            drawWalls();
        }, 400);
    };

    addFire(bomb.x, bomb.y);

    const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];

    const range = bomb.range || 1;

    directions.forEach(([dx, dy]) => {
        for (let r = 1; r <= range; r++) {
            const fx = bomb.x + dx * r;
            const fy = bomb.y + dy * r;

            if (fx < 0 || fx >= s.mapWidth || fy < 0 || fy >= s.mapHeight) break;

            if (grid[fy][fx] === 2) break;

            if (grid[fy][fx] === 1) {
                grid[fy][fx] = 0;
                addFire(fx, fy);
                break;
            }

            addFire(fx, fy);
        }
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
    if (e.repeat) return;
    if (e.key === 'ArrowUp') { keysDown.up = true; movedThisPress.up = false; holdStartAt.up = performance.now(); }
    else if (e.key === 'ArrowDown') { keysDown.down = true; movedThisPress.down = false; holdStartAt.down = performance.now(); }
    else if (e.key === 'ArrowLeft') { keysDown.left = true; movedThisPress.left = false; holdStartAt.left = performance.now(); }
    else if (e.key === 'ArrowRight') { keysDown.right = true; movedThisPress.right = false; holdStartAt.right = performance.now(); }
    else if (e.code === 'Space') {
        e.preventDefault();
        placeBomb();
    }
});

document.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp') { keysDown.up = false; movedThisPress.up = false; }
    else if (e.key === 'ArrowDown') { keysDown.down = false; movedThisPress.down = false; }
    else if (e.key === 'ArrowLeft') { keysDown.left = false; movedThisPress.left = false; }
    else if (e.key === 'ArrowRight') { keysDown.right = false; movedThisPress.right = false; }
});

let keysDown = { up: false, down: false, left: false, right: false };
let lastMoveAt = 0;

const HOLD_REPEAT_DELAY_MS = 180;
const MIN_INTERVAL_MS = 80;

let movedThisPress = { up: false, down: false, left: false, right: false };
let holdStartAt = { up: 0, down: 0, left: 0, right: 0 };

function stepMovement() {
    const s = state.getState();
    const { bomber, grid, mapWidth, mapHeight } = s;

    let dir = null, dx = 0, dy = 0;

    if (keysDown.up && !movedThisPress.up) { dir = 'up'; dy = -1; bomber.direction = 'up'; }
    else if (keysDown.down && !movedThisPress.down) { dir = 'down'; dy = 1; bomber.direction = 'down'; }
    else if (keysDown.left && !movedThisPress.left) { dir = 'left'; dx = -1; bomber.direction = 'left'; }
    else if (keysDown.right && !movedThisPress.right) { dir = 'right'; dx = 1; bomber.direction = 'right'; }
    else return; // No new press, no move

    // Calculate next position
    const nextX = bomber.x + dx;
    const nextY = bomber.y + dy;

    // Bounds check
    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;

    // Collision check
    const cell = grid[nextY][nextX];
    if (cell === 1 || cell === 2) return;

    // Move player
    bomber.x = nextX;
    bomber.y = nextY;

    movedThisPress[dir] = true; // Mark as moved for this key press

    update();
    sendMovement(nextX, nextY);
    tryPickupPowerup();
}

let activeToast = null;

export function showToast(message, duration = 3000) {
    // Overlay (create once)
    let overlay = document.getElementById('toast-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'toast-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'transparent',
            zIndex: 9999,
            pointerEvents: 'auto',
        });

        // Block pointer & keyboard events
        ['click','mousedown','mouseup','touchstart','touchend','keydown','keyup','keypress']
            .forEach(evt => overlay.addEventListener(evt, e => e.stopPropagation(), true));

        overlay.tabIndex = 0;
        document.body.appendChild(overlay);
        overlay.focus();
    }

    // Toast container (create once)
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        Object.assign(toastContainer.style, {
            position: 'fixed',
            bottom: '50%',
            left: '50%',
            transform: 'translate(-50%, 50%)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none',
        });
        document.body.appendChild(toastContainer);
    }

    // Remove existing toast immediately if any
    if (activeToast) {
        activeToast.remove();
        activeToast = null;
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '12px 24px',
        fontSize: '25px',
        pointerEvents: 'auto',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        userSelect: 'none',
    });

    toastContainer.appendChild(toast);
    activeToast = toast;

    // Fade in
    requestAnimationFrame(() => toast.style.opacity = '1');

    // Fade out after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => {
            if (toast === activeToast) {
                toast.remove();
                activeToast = null;
            }
        }, { once: true });
    }, duration);
}


function handleGameOver() {
    showToast("Game Over! You ran out of lives.", 4000);

    setTimeout(() => {
        window.location.href = '/';
    }, 4000);
}
