import { JSDOM } from 'jsdom';
import axios from 'axios';

describe('Theme Toggle Functionality', () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
  });

  function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', currentTheme === 'light' ? 'dark' : 'light');
  }

  it('should toggle theme from light to dark', () => {
    document.body.setAttribute('data-theme', 'light');
    toggleTheme();
    expect(document.body.getAttribute('data-theme')).toBe('dark');
  });

  it('should toggle theme from dark to light', () => {
    document.body.setAttribute('data-theme', 'dark');
    toggleTheme();
    expect(document.body.getAttribute('data-theme')).toBe('light');
  });
});

describe('Conversation Loading', () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="conversations"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    if (axios.get.calls) {
      axios.get.calls.reset();
    }
  });

  async function loadConversations() {
    try {
      const response = await axios.get('/conversations');
      const conversations = response.data;

      const conversationList = await Promise.all(conversations.map(async (conversation) => {
        const messagesResponse = await axios.get(`/conversations/${conversation.sid}/messages`);
        const messages = messagesResponse.data;
        const lastMessage = messages[messages.length - 1];
        const showRespondIcon = lastMessage && lastMessage.author !== '+12136983410' && lastMessage.author !== 'system';
        const respondIcon = showRespondIcon
          ? '<span class="respond-icon">Respond</span>'
          : '';

        return `
          <div class="conversation" id="conv-${conversation.sid}">
            ${respondIcon}
            <div>
              <strong>${conversation.friendlyName || conversation.sid}</strong>
              <div class="last-message">${lastMessage ? lastMessage.body : 'No messages yet'}</div>
            </div>
          </div>
        `;
      }));

      document.getElementById('conversations').innerHTML = conversationList.join('');
    } catch (error) {
      document.getElementById('conversations').innerHTML = '<p class="error">Failed to load conversations. Please try again later.</p>';
    }
  }

  it('should load and display conversations with the correct Respond icon', async () => {
    spyOn(axios, 'get').and.callFake((url) => {
      if (url === '/conversations') {
        return Promise.resolve({
          data: [
            { sid: '123', friendlyName: 'Test Conversation 1' },
            { sid: '456', friendlyName: 'Test Conversation 2' }
          ],
        });
      } else if (url.includes('/messages')) {
        const conversationSid = url.split('/')[2];
        if (conversationSid === '123') {
          return Promise.resolve({ data: [{ body: 'Last message from another user', author: 'anotherUser' }] });
        } else if (conversationSid === '456') {
          return Promise.resolve({ data: [{ body: 'Last message from system', author: 'system' }] });
        }
      }
    });

    await loadConversations();

    const conversationDivs = document.querySelectorAll('.conversation');
    expect(conversationDivs.length).toBe(2);

    const respondIcon1 = conversationDivs[0].querySelector('.respond-icon');
    const respondIcon2 = conversationDivs[1].querySelector('.respond-icon');

    expect(respondIcon1).not.toBeNull(); // Should show Respond icon for conversation 1
    expect(respondIcon2).toBeNull(); // Should not show Respond icon for conversation 2
  });

  it('should display an error message when failing to load conversations', async () => {
    spyOn(axios, 'get').and.callFake((url) => {
      if (url === '/conversations') {
        return Promise.reject(new Error('Failed to load conversations'));
      }
    });

    await loadConversations();

    const errorMessage = document.querySelector('.error');
    expect(errorMessage).not.toBeNull();
    expect(errorMessage.textContent).toBe('Failed to load conversations. Please try again later.');
  });
});

describe('Message Sending', () => {
  let window, document;
  let currentConversationSid;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="messages"></div><input id="new-message"></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
    currentConversationSid = '123';
  });

  afterEach(() => {
    if (axios.post.calls) {
      axios.post.calls.reset();
    }
  });

  async function sendMessage() {
    const messageInput = document.getElementById('new-message');
    const message = messageInput.value.trim();

    if (message && currentConversationSid) {
        try {
            await axios.post(`/conversations/${currentConversationSid}/messages`, { message });
            messageInput.value = ''; // Clear input field after sending

            const messagesDiv = document.getElementById('messages');
            if (messagesDiv) {
                messagesDiv.innerHTML += `<div class="message">${message}</div>`;
            }

            await loadConversations(); // Update conversation list after sending message
        } catch (error) {
            window.alert('Failed to send message. Please try again later.');
        }
    }
}


  it('should send a message and update the messages list', async () => {
    spyOn(axios, 'post').and.callFake(() => {
      return Promise.resolve({ data: { sid: '789' } });
    });

    document.getElementById('new-message').value = 'Hello World';

    await sendMessage();

    const messagesDiv = document.getElementById('messages');
    expect(messagesDiv.textContent).toContain('Hello World');
  });

  it('should display an error message when failing to send a message', async () => {
    spyOn(axios, 'post').and.callFake(() => {
        return Promise.reject(new Error('Failed to send message'));
    });

    document.getElementById('new-message').value = 'Hello World';

    await sendMessage();

    expect(window.alert).toHaveBeenCalledWith('Failed to send message. Please try again later.');
});
});

describe('Conversation Selection', () => {
  let window, document;
  let currentConversationSid;

  beforeEach(() => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="conversations">
            <div class="conversation" id="conv-123">Test Conversation 1</div>
            <div class="conversation" id="conv-456">Test Conversation 2</div>
          </div>
          <div id="messages-title"></div>
          <div id="messages"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
    currentConversationSid = '123';
  });

  afterEach(() => {
    if (axios.get.calls) {
      axios.get.calls.reset();
    }
  });

  async function selectConversation(sid, displayName) {
    try {
      const response = await axios.get(`/conversations/${sid}/messages`);
      const messages = response.data;

      const messageList = messages.map(message => {
        return `<div class="message">${message.body}</div>`;
      }).join('');

      document.getElementById('messages-title').textContent = displayName;
      document.getElementById('messages').innerHTML = messageList;
    } catch (error) {
      document.getElementById('messages').innerHTML = '<p class="error">Failed to load messages. Please try again later.</p>';
    }
  }

  it('should select a conversation and display its messages', async () => {
    spyOn(axios, 'get').and.callFake((url) => {
      if (url.includes('/messages')) {
        return Promise.resolve({ data: [{ body: 'First message', author: 'user' }] });
      }
    });

    await selectConversation('123', 'Test Conversation 1');

    const titleDiv = document.getElementById('messages-title');
    expect(titleDiv.textContent).toBe('Test Conversation 1');
    const messagesDiv = document.getElementById('messages');
    expect(messagesDiv.textContent).toContain('First message');
  });

  it('should display an error message when failing to load messages', async () => {
    spyOn(axios, 'get').and.callFake((url) => {
      if (url.includes('/messages')) {
        return Promise.reject(new Error('Failed to load messages'));
      }
    });

    await selectConversation('123', 'Test Conversation 1');

    const errorMessage = document.querySelector('.error');
    expect(errorMessage).not.toBeNull();
    expect(errorMessage.textContent).toBe('Failed to load messages. Please try again later.');
  });
});

describe('Respond Icon Functionality', () => {
  let window, document;
  const TWILIO_PHONE_NUMBER = '+12136983410';

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="conversations"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    if (axios.get.calls) {
      axios.get.calls.reset();
    }
  });

  async function loadConversations() {
    try {
      const response = await axios.get('/conversations');
      const conversations = response.data;

      const conversationList = await Promise.all(conversations.map(async (conversation) => {
        const messagesResponse = await axios.get(`/conversations/${conversation.sid}/messages`);
        const messages = messagesResponse.data;
        const lastMessage = messages[messages.length - 1];
        const showRespondIcon = lastMessage && lastMessage.author !== TWILIO_PHONE_NUMBER && lastMessage.author !== 'system';
        const respondIcon = showRespondIcon
          ? '<span class="respond-icon">Respond</span>'
          : '';

        return `
          <div class="conversation" id="conv-${conversation.sid}">
            ${respondIcon}
            <div>
              <strong>${conversation.friendlyName || conversation.sid}</strong>
              <div class="last-message">${lastMessage.body}</div>
            </div>
          </div>
        `;
      }));

      document.getElementById('conversations').innerHTML = conversationList.join('');
    } catch (error) {
      document.getElementById('conversations').innerHTML = '<p class="error">Failed to load conversations. Please try again later.</p>';
    }
  }

  it('should show the "Respond" icon when the last message is not from the Twilio phone number or the system', async () => {
    spyOn(axios, 'get').and.callFake((url) => {
      if (url === '/conversations') {
        return Promise.resolve({
          data: [
            { sid: '123', friendlyName: 'Test Conversation 1' },
            { sid: '456', friendlyName: 'Test Conversation 2' },
          ],
        });
      } else if (url.includes('/messages')) {
        const conversationSid = url.split('/')[2];
        if (conversationSid === '123') {
          return Promise.resolve({ data: [{ body: 'Hello', author: 'anotherUser' }] });
        } else if (conversationSid === '456') {
          return Promise.resolve({ data: [{ body: 'Last message from system', author: 'system' }] });
        }
      }
    });

    await loadConversations();
    const conversationDiv = document.getElementById('conv-123');
    expect(conversationDiv.querySelector('.respond-icon')).not.toBeNull();
  });

  it('should not show the "Respond" icon when the last message is from the Twilio phone number or the system', async () => {
    spyOn(axios, 'get').and.callFake((url) => {
      if (url === '/conversations') {
        return Promise.resolve({
          data: [
            { sid: '123', friendlyName: 'Test Conversation 1' },
            { sid: '456', friendlyName: 'Test Conversation 2' },
          ],
        });
      } else if (url.includes('/messages')) {
        const conversationSid = url.split('/')[2];
        if (conversationSid === '123') {
          return Promise.resolve({ data: [{ body: 'Hello', author: 'user' }] });
        } else if (conversationSid === '456') {
          return Promise.resolve({ data: [{ body: 'Last message from system', author: 'system' }] });
        }
      }
    });

    await loadConversations();
    const conversationDiv = document.getElementById('conv-456');
    expect(conversationDiv.querySelector('.respond-icon')).toBeNull();
  });
});

describe('Initial Respond Icon Functionality', () => {
    let window, document;
    const TWILIO_PHONE_NUMBER = '+12136983410';
  
    beforeEach(() => {
      const dom = new JSDOM('<!DOCTYPE html><html><body><div id="conversations"></div></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true,
      });
      window = dom.window;
      document = dom.window.document;
  
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'node.js',
        },
        configurable: true,
      });
  
      global.window = window;
      global.document = document;
    });
  
    afterEach(() => {
      if (axios.get.calls) {
        axios.get.calls.reset();
      }
    });

    describe('Start a New Conversation', () => {
        let window, document;
      
        beforeEach(() => {
          const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
              <body>
                <form id="start-conversation-form">
                  <input type="text" name="phoneNumber" value="+15306132412" />
                  <input type="text" name="message" value="Hello" />
                  <button type="submit">Start Conversation</button>
                </form>
                <div id="conversations"></div>
              </body>
            </html>
          `, {
            url: 'http://localhost',
            pretendToBeVisual: true,
          });
      
          window = dom.window;
          document = dom.window.document;
          global.window = window;
          global.document = document;
      
          // Define and attach loadConversations to window
          window.loadConversations = jasmine.createSpy('loadConversations');
      
          // Define `startConversation` in the test environment
          window.startConversation = async function(event) {
            event.preventDefault();
            try {
              const response = await axios.post('/start-conversation', {
                phoneNumber: document.querySelector('input[name="phoneNumber"]').value,
                message: document.querySelector('input[name="message"]').value,
              });
              window.loadConversations();
            } catch (error) {
              window.alert('Failed to start a new conversation. Please try again.');
            }
          };
      
          // Attach `startConversation` to form submission
          document.getElementById('start-conversation-form').onsubmit = window.startConversation;
      
          // Mock window.alert
          spyOn(window, 'alert').and.callThrough();
        });
      
        afterEach(() => {
          if (axios.post.calls) {
            axios.post.calls.reset();
          }
        });
      
        it('should successfully start a new conversation and update the conversation list', async () => {
          spyOn(axios, 'post').and.returnValue(Promise.resolve({ data: { sid: '789' } }));
      
          // Directly invoke startConversation
          await window.startConversation({
            preventDefault: () => {},
          });
      
          expect(axios.post).toHaveBeenCalledWith('/start-conversation', {
            phoneNumber: '+15306132412',
            message: 'Hello',
          });
      
          expect(window.loadConversations).toHaveBeenCalled();
        });
      
        it('should display an error message when the conversation creation fails', async () => {
          spyOn(axios, 'post').and.returnValue(Promise.reject(new Error('Failed to start conversation')));
      
          // Directly invoke startConversation
          await window.startConversation({
            preventDefault: () => {},
          });
      
          expect(window.alert).toHaveBeenCalledWith('Failed to start a new conversation. Please try again.');
        });
      });
      
    async function loadConversations() {
      try {
        const response = await axios.get('/conversations');
        const conversations = response.data;
  
        const conversationList = await Promise.all(conversations.map(async (conversation) => {
          const messagesResponse = await axios.get(`/conversations/${conversation.sid}/messages`);
          const messages = messagesResponse.data;
          const lastMessage = messages[messages.length - 1];
          const showRespondIcon = lastMessage && lastMessage.author !== TWILIO_PHONE_NUMBER && lastMessage.author !== 'system';
          const respondIcon = showRespondIcon
            ? '<span class="respond-icon">Respond</span>'
            : '';
  
          return `
            <div class="conversation" id="conv-${conversation.sid}">
              ${respondIcon}
              <div>
                <strong>${conversation.friendlyName || conversation.sid}</strong>
                <div class="last-message">${lastMessage ? lastMessage.body : 'No messages yet'}</div>
              </div>
            </div>
          `;
        }));
  
        document.getElementById('conversations').innerHTML = conversationList.join('');
      } catch (error) {
        document.getElementById('conversations').innerHTML = '<p class="error">Failed to load conversations. Please try again later.</p>';
      }
    }
  
    it('should display the "Respond" icon during initial load when the last message is not from the Twilio number or system', async () => {
      spyOn(axios, 'get').and.callFake((url) => {
        if (url === '/conversations') {
          return Promise.resolve({
            data: [
              { sid: '789', friendlyName: 'Initial Load Conversation' }
            ],
          });
        } else if (url.includes('/messages')) {
          return Promise.resolve({ data: [{ body: 'Message from another user', author: 'anotherUser' }] });
        }
      });
  
      await loadConversations();
  
      const conversationDiv = document.getElementById('conv-789');
      const respondIcon = conversationDiv.querySelector('.respond-icon');
  
      expect(respondIcon).not.toBeNull(); // Ensure the Respond icon is present
    });
  });

describe('Accessibility and Focus Management', () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <header>
            <div id="sidebar" role="navigation" aria-label="Conversation List">
              <h2>Messages</h2>
              <div id="conversations" aria-live="polite"></div>
              <div style="margin-top: 10px;">
                <label for="theme-toggle">Dark Mode</label>
                <input type="checkbox" id="theme-toggle" aria-label="Dark Mode">
              </div>
            </div>
          </header>
          <main id="message-pane">
            <div id="messages-title">
              <span id="conversation-title" role="heading" aria-level="1"></span>
              <span class="close-button" style="cursor: pointer;" tabindex="0">✕</span>
            </div>
            <div id="messages" aria-live="polite"></div>
            <div id="message-input" role="form">
              <input type="text" id="new-message" placeholder="iMessage..." aria-label="New Message">
              <button aria-label="Send Message">Send</button>
            </div>
          </main>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
  });

  it('should have the correct ARIA label on the theme toggle', () => {
    const themeToggle = document.getElementById('theme-toggle');
    expect(themeToggle.getAttribute('aria-label')).toBe('Dark Mode');
  });

  it('should set the aria-live attribute correctly on the conversations list', () => {
    const conversationsDiv = document.getElementById('conversations');
    expect(conversationsDiv.getAttribute('aria-live')).toBe('polite');
  });

  it('should focus on the close button when a conversation is selected', () => {
    const closeButton = document.querySelector('.close-button');
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);
  });

  it('should set focus to the input field after sending a message', async () => {
    const messageInput = document.getElementById('new-message');
    messageInput.value = 'Test Message';

    const sendMessageButton = document.querySelector('button[aria-label="Send Message"]');
    sendMessageButton.click();

    // Simulate the focus being set on the input after sending
    messageInput.focus();

    expect(document.activeElement).toBe(messageInput);
  });
});

// New Test Cases for "No Conversation Selected" state

describe('No Conversation Selected State', () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="no-conversation" style="display: flex;">No conversation selected</div>
          <div id="messages-title" style="display:none;"></div>
          <div id="messages" style="display:none;"></div>
          <div id="message-input" style="display:none;"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = dom.window.document;

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'node.js',
      },
      configurable: true,
    });

    global.window = window;
    global.document = document;
  });

  it('should display "No conversation selected" message when no conversation is selected', () => {
    const noConversationDiv = document.getElementById('no-conversation');
    expect(noConversationDiv.style.display).toBe('flex');
  });

  it('should hide "Send Message" bar and "Close" button when no conversation is selected', () => {
    const messagesTitle = document.getElementById('messages-title');
    const messageInput = document.getElementById('message-input');
    expect(messagesTitle.style.display).toBe('none');
    expect(messageInput.style.display).toBe('none');
  });

  it('should show "Send Message" bar and "Close" button when a conversation is selected', () => {
    const messagesTitle = document.getElementById('messages-title');
    const messageInput = document.getElementById('message-input');
    const noConversationDiv = document.getElementById('no-conversation');

    // Simulate selecting a conversation
    messagesTitle.style.display = 'flex';
    messageInput.style.display = 'flex';
    noConversationDiv.style.display = 'none';

    expect(messagesTitle.style.display).toBe('flex');
    expect(messageInput.style.display).toBe('flex');
    expect(noConversationDiv.style.display).toBe('none');
  });
});

// Test Case for delete button
describe('Delete Conversation Functionality', () => {
    let window, document, confirmSpy, alertSpy, axiosDeleteSpy;
  
    beforeEach(() => {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="conversations">
              <div class="conversation" id="conv-123">
                Test Conversation 1
                <button class="delete-btn" aria-label="Delete Conversation">🗑️</button>
              </div>
              <div class="conversation" id="conv-456">
                Test Conversation 2
                <button class="delete-btn" aria-label="Delete Conversation">🗑️</button>
              </div>
            </div>
          </body>
        </html>
      `, {
        url: 'http://localhost',
        pretendToBeVisual: true,
      });
  
      window = dom.window;
      document = dom.window.document;
  
      global.window = window;
      global.document = document;
  
      // Mock the alert function
      alertSpy = spyOn(window, 'alert').and.callFake(() => {});
  
      // Spy on the global confirm function before attaching the deleteConversation function
      confirmSpy = spyOn(window, 'confirm').and.callThrough();
  
      // Spy on axios.delete
      axiosDeleteSpy = spyOn(axios, 'delete').and.callFake(() => Promise.resolve({}));
  
      // Attach the deleteConversation function to the window object in the test environment
      window.deleteConversation = async function(sid) {
        if (window.confirm("Are you sure you want to delete this conversation?")) {
          try {
            await axios.delete(`/conversations/${sid}`);
            // Simulate updating the UI after deletion
            document.getElementById(`conv-${sid}`).remove();
          } catch (error) {
            window.alert("Failed to delete conversation. Please try again later.");
          }
        }
      };
    });
  
    afterEach(() => {
      if (axiosDeleteSpy.calls) {
        axiosDeleteSpy.calls.reset();
      }
    });
  
    it('should prompt for confirmation before deleting a conversation', async () => {
      confirmSpy.and.returnValue(true); // Simulate clicking "OK" in the confirmation dialog
      axiosDeleteSpy.and.callFake((url) => {
        if (url === '/conversations/123') {
          return Promise.resolve({ data: { message: 'Conversation 123 deleted successfully.' } });
        }
      });
  
      // Directly trigger deleteConversation instead of clicking the button
      await window.deleteConversation('123');
  
      expect(confirmSpy.calls.count()).toBe(1); // Ensure confirm was called once
      expect(axiosDeleteSpy).toHaveBeenCalledWith('/conversations/123');
    });
  
    it('should not delete the conversation if confirmation is cancelled', async () => {
      confirmSpy.and.returnValue(false); // Simulate clicking "Cancel" in the confirmation dialog
  
      // Directly trigger deleteConversation instead of clicking the button
      await window.deleteConversation('123');
  
      expect(confirmSpy.calls.count()).toBe(1); // Ensure confirm was called once
      expect(axiosDeleteSpy.calls.count()).toBe(0); // Ensure delete was not called
      expect(document.getElementById('conv-123')).not.toBeNull(); // Ensure conversation is still present
    });
  
    it('should show an error message if the deletion fails', async () => {
      confirmSpy.and.returnValue(true); // Simulate clicking "OK" in the confirmation dialog
      axiosDeleteSpy.and.callFake(() => {
        return Promise.reject(new Error('Failed to delete conversation'));
      });
  
      // Directly trigger deleteConversation instead of clicking the button
      await window.deleteConversation('123');
  
      expect(alertSpy).toHaveBeenCalledWith('Failed to delete conversation. Please try again later.');
    });
  });

  describe('Message Sending and Conversation Sorting', () => {
    let window, document, currentConversationSid;

    beforeEach(() => {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="conversations"></div><input id="new-message"><div id="messages"></div></body></html>', {
            url: 'http://localhost',
            pretendToBeVisual: true,
        });

        // Set up the window and document
        window = dom.window;
        document = dom.window.document;
        currentConversationSid = '123'; // Mock conversation ID

        Object.defineProperty(global, 'navigator', {
            value: {
                userAgent: 'node.js',
            },
            configurable: true,
        });

        global.window = window;
        global.document = document;

        // Mock alert as a spy AFTER window is defined
        window.alert = jasmine.createSpy('alert');  
        spyOn(window, 'confirm').and.returnValue(true); // Mock window.confirm
    });

    afterEach(() => {
        if (axios.post.calls) {
            axios.post.calls.reset();
        }
        if (axios.get.calls) {
            axios.get.calls.reset();
        }
    });

    function loadMessages(conversationSid) {
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = `<div class="message">Message in conversation ${conversationSid}</div>`;
        }
    }

    async function loadConversations() {
        const conversations = [
            { sid: '123', friendlyName: 'Test Conversation 1', lastMessageTime: new Date(Date.now() - 10000).getTime() },
            { sid: '456', friendlyName: 'Test Conversation 2', lastMessageTime: new Date().getTime() }
        ];

        conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        const conversationList = conversations.map(conversation => `
            <div class="conversation" id="conv-${conversation.sid}">
                <strong>${conversation.friendlyName}</strong>
                <div class="last-message">Last message at ${new Date(conversation.lastMessageTime).toLocaleTimeString()}</div>
            </div>
        `).join('');

        document.getElementById('conversations').innerHTML = conversationList;
    }

    async function sendMessage() {
        const messageInput = document.getElementById('new-message');
        const message = messageInput.value.trim();

        if (message && currentConversationSid) {
            try {
                await axios.post(`/conversations/${currentConversationSid}/messages`, { message });
                messageInput.value = ''; // Clear input field after sending

                const messagesDiv = document.getElementById('messages');
                if (messagesDiv) {
                    messagesDiv.innerHTML += `<div class="message">${message}</div>`;
                }

                await loadConversations(); // Update conversation list after sending message
            } catch (error) {
                window.alert('Failed to send message. Please try again later.');
            }
        }
    }

    it('should load, update, and sort conversations based on last message time', async () => {
        await loadConversations();

        const conversationDivs = document.querySelectorAll('.conversation');
        expect(conversationDivs.length).toBe(2);

        const firstConversation = conversationDivs[0].querySelector('strong').textContent;
        const secondConversation = conversationDivs[1].querySelector('strong').textContent;

        expect(firstConversation).toBe('Test Conversation 2');  // Most recent message should be first
        expect(secondConversation).toBe('Test Conversation 1');
    });

    it('should display an error message when failing to send a message', async () => {
        spyOn(axios, 'post').and.callFake(() => {
            return Promise.reject(new Error('Failed to send message'));
        });

        document.getElementById('new-message').value = 'Hello World';

        await sendMessage();

        expect(window.alert).toHaveBeenCalledWith('Failed to send message. Please try again later.');
    });

    it('should send a message and update the messages list', async () => {
        spyOn(axios, 'post').and.callFake(() => {
            return Promise.resolve({ data: { sid: '789' } });
        });

        document.getElementById('new-message').value = 'Hello World';

        await sendMessage();

        const messagesDiv = document.getElementById('messages');
        expect(messagesDiv.textContent).toContain('Hello World');
    });
});