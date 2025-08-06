# 💣 Bomberman-DOM

A multiplayer Bomberman-style browser game built using pure JavaScript, HTML, and WebSocket for real-time communication. Players can move, drop bombs, and compete in real-time on a grid-based map rendered with dynamic DOM manipulation.

## Features

- Real-time multiplayer gameplay via WebSockets
- Destructible and indestructible walls
- Bomb placement
- Life system
- Dynamic map rendering
- Lobby 
- LocalStorage session management
- Real-time chat

## Screenshots

> You can add more screenshots like `Picture4.jpg`, etc.

## 🛠Tech Stack

- **Frontend**: HTML, CSS, JavaScript (no frameworks)
- **Backend**: Node.js with `ws` (WebSocket server)
- **Assets**: Sprite sheets and custom DOM-based game rendering
- **State Management**: Custom lightweight StateManager
- **Routing & Views**: Simple custom framework with `Router` and `ViewRenderer`

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/NADRA03/bomberman-dom.git
cd bomberman-dom
````

### 2. Install dependencies

```bash
npm install
```

### 3. Run the game server

```bash
npm start
```

Then visit: `http://localhost:8000` in your browser.

## 🕹️ Controls

| Key     | Action      |
| ------- | ----------- |
| ↑ ↓ ← → | Move player |
| Space   | Drop bomb   |

## 📁 Project Structure

```
bomberman-dom/
├── public/
│   ├── img/               # Game assets (walls, bomber, etc.)
│   ├── css/  
│   ├── index.html
│   └── js/          # Frontend logic and rendering
├── backend/
│   └── server.js             # WebSocket game server  
├── package.json
└── README.md
```

## Hosting

* Works on localhost by default
* Can be hosted on platforms like **Render**, **Vercel (frontend only)**, or **Glitch**
* For multiplayer to work remotely, the server must be publicly accessible


## License

MIT License

---

Made with ❤️ by [NADRA03](https://github.com/NADRA03) and [zahraalhaj](https://github.com/zahraalhaj)
