// EventBus: Lightweight pub/sub system
export class EventBus {
  constructor() {
    this.events = {};
  }

  // Register a callback for an event
  on(event, callback) {
    (this.events[event] ||= []).push(callback);
  }

  // Unregister a specific callback
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  // Emit an event to all listeners
  emit(event, data) {
    (this.events[event] || []).forEach(callback => callback(data));
  }
}

// StateManager
export class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.eventBus = new EventBus();
  }

  // Update state (either partial object or via updater function)
  setState(updater) {
    const newState = typeof updater === 'function' ? updater(this.state) : updater;
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.eventBus.emit('stateChange', { state: this.state, prevState });
  }

  // Get a copy of the current state
  getState() {
    return { ...this.state };
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.eventBus.on('stateChange', callback);
  }

  // Unsubscribe from state changes
  unsubscribe(callback) {
    this.eventBus.off('stateChange', callback);
  }
}

//  Router: Handles path-based SPA routing
export class Router {
  constructor() {
    this.routes = {};
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('DOMContentLoaded', () => this.handleRoute()); 
  }

  // Add a route with its handler
  add(path, handler) {
    this.routes[path] = handler;
  }

  // Navigate by setting window.location.hash
  navigate(path) {
    if (window.location.hash.slice(1) !== path) {
      window.location.hash = path;
    } else {
      this.handleRoute(); 
    }
  }

  // Handle the route logic by parsing hash
  handleRoute() {
    const path = window.location.hash.slice(1) || '/';
    const handler = this.routes[path];
    if (handler) handler();
  }

  // Enables [data-route] links to trigger SPA nav
  bindRouteLinks(container) {
    container.addEventListener('click', e => {
      const target = e.target.closest('[data-route]');
      if (target) {
        e.preventDefault();
        this.navigate(target.getAttribute('data-route'));
      }
    });
  }
}

// ViewRenderer: Handles DOM rendering using declarative virtual nodes
export class ViewRenderer {
  constructor(container) {
    this.root = typeof container === 'string' ? document.querySelector(container) : container;
    this.renderFn = null;
    this.stateManager = null;
    this.scheduled = false;
  }

  // Create DOM elements using a simple virtual node API
  el(tag, props, ...children) {
    if (typeof tag === 'function') return tag(props || {});
    const element = document.createElement(tag);

    if (props) {
      for (const [key, val] of Object.entries(props)) {
        if (key === 'className') element.className = val;
        else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
        else if (key === 'bind' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
          const stateKey = val;
          const bindTrigger = props.bindTrigger || 'input';
          const currentValue = this.stateManager?.getState()[stateKey] || '';

          element.setAttribute('bind', stateKey);
          if (document.activeElement !== element) {
            element.value = currentValue;
          }

          if (bindTrigger === 'input') {
            element.oninput = e => {
              this.stateManager?.setState(s => ({ ...s, [stateKey]: e.target.value }));
            };
          } else if (bindTrigger === 'blur') {
            element.onblur = e => {
              this.stateManager?.setState(s => ({ ...s, [stateKey]: e.target.value }));
            };
          }
        }
        else if (key.startsWith('on') && typeof val === 'function') {
          element.addEventListener(key.slice(2).toLowerCase(), val);
        }
        else if (val !== false && val != null) element.setAttribute(key, val);
      }
    }

    children.flat().forEach(child => {
      if (child === false || child == null) return;
      if (typeof child === 'string' || typeof child === 'number') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      } else {
        console.warn('Invalid child element in el()', child);
      }
    });

    return element;
  }

  // Attach render function and subscribe to state changes
  mount(stateManager, renderFn) {
    this.stateManager = stateManager;
    this.renderFn = renderFn;
    this.stateManager.subscribe(() => this.scheduleRender());
    this.scheduleRender();
  }

  // Schedule a render via microtask queue
  scheduleRender() {
    if (this.scheduled) return;
    this.scheduled = true;
    Promise.resolve().then(() => {
      this.scheduled = false;
      this.render();
    });
  }

  // Run the actual render
render() {
  if (!this.renderFn || !this.root) return;

  const newVNode = this.renderFn(this.stateManager.getState(), this.el.bind(this));

  // Try to preserve typing state
  const active = document.activeElement;
  const isTyping = active && ['INPUT', 'TEXTAREA'].includes(active.tagName);

  const temp = document.createElement('div');
  temp.appendChild(newVNode);

  if (
    isTyping &&
    this.root.firstChild &&
    this.root.firstChild.isEqualNode(temp.firstChild)
  ) {
    return; // skip render
  }

  this.root.innerHTML = '';
  this.root.appendChild(newVNode);
}

}

// GameLoop: Handles time-based updates for real-time games like Bomberman
export class GameLoop {
  constructor(update, render, fps = 60) {
    this.update = update;   
    this.render = render;   
    this.fps = fps;
    this.running = false;
    this.lastTime = 0;
  }

  // Start the loop
  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  // Stop the loop
  stop() {
    this.running = false;
  }

  // Internal loop using requestAnimationFrame
  loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const delta = now - this.lastTime;
    if (delta >= 1000 / this.fps) {
      this.update(delta / 1000); // delta in seconds
      this.render();
      this.lastTime = now;
    }
    requestAnimationFrame(this.loop);
  }
}

// WebSocket wrapper for multiplayer communication
export class NetworkManager {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.eventBus = new EventBus();

    this.socket.addEventListener('message', e => {
      const data = JSON.parse(e.data);
      this.eventBus.emit(data.type, data.payload);
    });
  }

  // Listen for messages by type
  on(type, callback) {
    this.eventBus.on(type, callback);
  }

  // Send a message with type and payload
  send(type, payload) {
    const message = JSON.stringify({ type, payload });
    console.log('[NetworkManager] Sending:', message);
    this.socket.send(message);
    // REMOVED THE DUPLICATE LINE THAT WAS CAUSING THE ERROR:
    // this.socket.send(message); // This was the bug!
  }
}

// Main class 
export class AppFramework {
  constructor({ state = {}, routes = {}, container = '#app', render }) {
    this.stateManager = new StateManager(state);
    this.router = new Router();
    this.view = new ViewRenderer(container);

    // Register routes
    Object.entries(routes).forEach(([path, handler]) => this.router.add(path, handler));
    this.view.mount(this.stateManager, render);
    this.router.bindRouteLinks(this.view.root);
    this.router.handleRoute();
  }

  // Update state
  setState(updater) {
    this.stateManager.setState(updater);
  }

  // Get current state
  getState() {
    return this.stateManager.getState();
  }

  // Navigate via Router
  navigate(path) {
    this.router.navigate(path);
  }

  // Create element shorthand
  el = (...args) => this.view.el(...args);

  // real-time game loop
  createGameLoop(update, render, fps = 60) {
    return new GameLoop(update, render, fps);
  }

  // Connect to a WebSocket server
  connectWebSocket(url) {
    return new NetworkManager(url);
  }
}
