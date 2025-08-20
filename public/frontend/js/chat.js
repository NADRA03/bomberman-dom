import { StateManager, ViewRenderer } from './mini-framework.js';
import { sendChatMessage, onChatMessage } from './wsConnect.js';

const chatState = new StateManager({
  messages: [],
  currentInput: ''
});

let view = null;
let room = null;




export function initChat(containerSelector, roomName) {
  onChatMessage(({ room: msgRoom, from, text, id }) => {
    if (msgRoom !== room) return;

    chatState.setState(s => ({
      messages: [...s.messages, { from, text, id }]
    }));
    console.log('Incoming chat message:', { from, text, room: msgRoom, id });
  });

  room = roomName;
  view = new ViewRenderer(containerSelector);
  view.mount(chatState, renderChatUI);
}




// ---------------- UI ----------------
function renderChatUI(state, el) {
  const fireBlock = () => el('img', {
    src: './frontend/img/solid.png',
    alt: 'fire block',
    style: {
      width: '24px',
      height: '24px',
      display: 'inline-block',
      userSelect: 'none',
      flexShrink: 0
    }
  });

  const blocksPerRow = 17;  
  const blocksPerColumn = 17; 
  const containerSize = blocksPerRow * 24; 
  const innerMessagesHeight = containerSize - 24 * 2; 
  const innerMessagesWidth = containerSize - 24 * 2;  

  const topFireRow = el('div', { style: { display: 'flex', gap: '0px' } },
    Array(blocksPerRow).fill(null).map((_, i) => fireBlock())
  );

  const bottomFireRow = el('div', { style: { display: 'flex', gap: '0px' } },
    Array(blocksPerRow).fill(null).map((_, i) => fireBlock())
  );

  const leftFireColumn = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0px' } },
    Array(blocksPerColumn).fill(null).map((_, i) => fireBlock())
  );

  const rightFireColumn = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0px' } },
    Array(blocksPerColumn).fill(null).map((_, i) => fireBlock())
  );

  return el('div', { className: 'chat-box' },
    el('div', {
      className: 'chat-messages',
      style: {
        height: containerSize + 'px',
        width: containerSize + 'px',
        boxSizing: 'content-box',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        fontFamily: 'monospace',
        border: 'none',
        overflow: 'hidden',
      }
    },
      topFireRow,
      el('div', {
        style: {
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden'
        }
      },
        leftFireColumn,
        el('div', {
          style: {
            height: innerMessagesHeight + 'px',
            width: innerMessagesWidth + 'px',
            overflowY: 'auto',
            padding: '5px 10px',
            boxSizing: 'border-box',
            userSelect: 'text'
          }
        },
          state.messages.map((msg, index) => {
            const id = document.cookie.match(/player_id=([^;]+)/)?.[1];
            const isMine = msg.id === id;
            console.log(msg)

            return el('div', {
              key: index,
              className: 'chat-msg',
              style: {
                marginBottom: '5px',
                textAlign: isMine ? 'right' : 'left'
              }
            },
              el('strong', {}, `${msg.from}: `),
              msg.text
            );
          })

        ),
        rightFireColumn
      ),
      bottomFireRow
    ),
    el('div', { style: { display: 'flex', gap: '5px', marginTop: '10px' } },
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




// ---------------- SEND ----------------
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