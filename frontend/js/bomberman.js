export const variables = {
    score: 0,
    level: 0,
    lives: 3,
    isGameOver: false,
    direction: "down",
    bomberElement: document.getElementById('bomber'),
    wallElements: [],
    bombElements: [],
    fireElements: [],
    bombs: [],
    fires: [],
    images: {
        fixed: "frontend/img/solid.png",
        random: "frontend/img/block.png"
    },
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
    mapWidth: 15,
    mapHeight: 13,
    gridSize: 40, 
    walls: [],
    cameraOffsetX: 0,
    cameraOffsetY: 0
};


function gameLoop() {
    update();
    requestAnimationFrame(gameLoop);
}

// Start the game
generateMap();
drawWalls();
gameLoop(); 

export function update() {
    const { bomber, bomberElement, gridSize } = variables;

    if (!variables.bomberElement) {
        const el = document.createElement('div');
        el.id = 'bomber';
        el.style.position = 'absolute';
        el.style.width = `${gridSize}px`;
        el.style.height = `${gridSize}px`;
        el.style.backgroundImage = "url('frontend/img/bomber.png')";
        el.style.backgroundSize = 'contain';
        el.style.zIndex = 1;
        document.body.appendChild(el);
        variables.bomberElement = el;
    }

    variables.bomberElement.style.left = `${bomber.x * gridSize}px`;
    variables.bomberElement.style.top = `${bomber.y * gridSize}px`;
}



export function drawWalls() {
    const { grid, gridSize, images } = variables;

    document.querySelectorAll(".tile").forEach(el => el.remove());

    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === 0) return; 

            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.position = 'absolute';
            tile.style.width = gridSize + 'px';
            tile.style.height = gridSize + 'px';
            tile.style.left = `${x * gridSize}px`;
            tile.style.top = `${y * gridSize}px`;
            tile.style.backgroundImage = `url('${cell === 2 ? images.fixed : images.random}')`;
            tile.style.backgroundSize = 'cover';
            tile.style.zIndex = '0';

            document.body.appendChild(tile);
        });
    });
}


export function generateMap() {
    const { mapWidth, mapHeight } = variables;
    const grid = [];

    for (let y = 0; y < mapHeight; y++) {
        const row = [];
        for (let x = 0; x < mapWidth; x++) {
            // 1. Outer border
            if (x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1) {
                row.push(2); // fixed wall
            }

            // 2. Reserved spawn areas (4 corners)
            else if (
                // Top-left
                (x === 1 && y === 1) || (x === 1 && y === 2) || (x === 2 && y === 1) ||
                // Top-right
                (x === mapWidth - 2 && y === 1) || 
                (x === mapWidth - 3 && y === 1) || 
                (x === mapWidth - 2 && y === 2) ||
                // Bottom-left
                (x === 1 && y === mapHeight - 2) ||
                (x === 2 && y === mapHeight - 2) ||
                (x === 1 && y === mapHeight - 3) ||
                // Bottom-right
                (x === mapWidth - 2 && y === mapHeight - 2) ||
                (x === mapWidth - 2 && y === mapHeight - 3) ||
                (x === mapWidth - 3 && y === mapHeight - 2)
            ) {
                row.push(0); // empty
            }

            // 3. Internal fixed wall (checkerboard)
            else if (x % 2 === 0 && y % 2 === 0) {
                row.push(2); // fixed
            }

            // 4. Random destructible wall or empty
            else {
                const isRandomWall = Math.random() < 0.4;
                row.push(isRandomWall ? 1 : 0);
            }
        }
        grid.push(row);
    }

    variables.grid = grid;
}





document.addEventListener('keydown', e => {
    const { bomber, grid, mapWidth, mapHeight } = variables;
    let nextX = bomber.x;
    let nextY = bomber.y;

    if (e.key === "ArrowUp") nextY--;
    else if (e.key === "ArrowDown") nextY++;
    else if (e.key === "ArrowLeft") nextX--;
    else if (e.key === "ArrowRight") nextX++;
    else return;

    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;

    const cell = grid[nextY][nextX];
    if (cell === 1 || cell === 2) return; 

    bomber.x = nextX;
    bomber.y = nextY;

    update();
});

document.addEventListener('keyup', e => {
    const b = variables.bomber;
    if (e.key === "ArrowUp") b.movingUp = false;
    if (e.key === "ArrowDown") b.movingDown = false;
    if (e.key === "ArrowLeft") b.movingLeft = false;
    if (e.key === "ArrowRight") b.movingRight = false;
});




