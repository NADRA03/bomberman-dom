import { StateManager, ViewRenderer } from './mini-framework.js';
import { sendChatMessage, onChatMessage } from './wsConnect.js';

const chatState = new StateManager({
  messages: [],
  currentInput: ''
});

let view = null;
let room = null;

export function initChat(containerSelector, roomName) {
  onChatMessage(({ room: msgRoom, from, text }) => {
    if (msgRoom !== room) return;
    
    chatState.setState(s => ({
      messages: [...s.messages, { from, text }]
    }));
    console.log('Incoming chat message:', { from, text, room: msgRoom });
  });
  
  room = roomName;
  view = new ViewRenderer(containerSelector);
  view.mount(chatState, renderChatUI);
}

function renderChatUI(state, el) {
  return el('div', { className: 'chat-box' },
    el('div', { 
      className: 'chat-messages',
      style: { 
        height: '200px', 
        overflowY: 'auto', 
        border: '1px solid #ccc', 
        padding: '10px',
        marginBottom: '10px'
      }
    },
      state.messages.map((msg, index) =>
        el('div', { 
          key: index,
          className: 'chat-msg',
          style: { marginBottom: '5px' }
        },
          el('strong', {}, `${msg.from}: `),
          msg.text
        )
      )
    ),
    el('div', { style: { display: 'flex', gap: '5px' } },
      el('input', {
        type: 'text',
        bind: 'currentInput',
        bindTrigger: 'input',
        placeholder: 'Type a message...',
        style: { flex: '1', padding: '5px' },
        onkeydown: e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
          }
        }
      }),
      el('button', {
        onclick: () => sendMessage(),
        style: { padding: '5px 10px' }
      }, 'Send')
    )
  );
}

function sendMessage() {
  const state = chatState.getState();
  const msg = state.currentInput.trim();
  if (!msg) return;
  
  const id = document.cookie.match(/player_id=([^;]+)/)?.[1];
  if (!id) {
    console.error('No player ID found in cookies');
    return;
  }
  
  console.log('Sending message:', { id, room, text: msg });
  sendChatMessage({ id, room, text: msg });
  
  chatState.setState({ currentInput: '' });
}