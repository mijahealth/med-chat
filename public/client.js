// client.js

let currentConversationSid;
let currentTheme = 'light';
let autoScrollEnabled = true;
let conversationsLoaded = false;
let socket;
let device;
let callStatusElement;
let TWILIO_PHONE_NUMBER;
let NGROK_URL;
let call;
let isMuted = false;

async function initializeApp() {
    try {
      const response = await axios.get('/config');
      TWILIO_PHONE_NUMBER = response.data.TWILIO_PHONE_NUMBER;
      NGROK_URL = response.data.NGROK_URL;
    } catch (error) {
      console.error('Error fetching configuration:', error);
    }
  }

// WebSocket connection setup
function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = function () {
    console.log('WebSocket connection established');
  };

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    console.log('Received WebSocket message:', data);
  
    if (data.type === 'newMessage') {
      handleNewMessage(data);
    } else if (data.type === 'newConversation') {
      handleNewConversation(data);
    }
  };

  socket.onclose = function () {
    console.log('WebSocket connection closed');
    setTimeout(setupWebSocket, 5000); // Attempt to reconnect after 5 seconds
  };

  socket.onerror = function (error) {
    console.error('WebSocket error:', error);
  };
}

function handleNewMessage(data) {
  // Play notification sound if the message is not from us
  if (data.author !== TWILIO_PHONE_NUMBER) {
    playNotificationSound();
  }

  if (currentConversationSid === data.conversationSid) {
    appendMessage(data);
  }

  updateConversationPreview(data.conversationSid, {
    body: data.body,
    author: data.author,
    dateCreated: new Date().toISOString(),
  });

  moveConversationToTop(data.conversationSid);

  if (currentConversationSid !== data.conversationSid) {
    markConversationAsUnread(data.conversationSid);
  }
}

function playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch((error) => {
      console.error('Error playing sound:', error);
    });
  }

  function markConversationAsUnread(conversationSid) {
    const conversationDiv = document.getElementById(`conv-${conversationSid}`);
    if (conversationDiv) {
      conversationDiv.classList.add('unread');
      const unreadIndicator = conversationDiv.querySelector('.unread-indicator');
      if (unreadIndicator && !unreadIndicator.querySelector('.unread-badge')) {
        const badgeHtml = `<span class="unread-badge">●</span>`;
        unreadIndicator.innerHTML = badgeHtml;
      }
    }
  }

  function handleNewConversation(data) {
    const conversationsDiv = document.getElementById('conversations');
    const existingConversation = document.getElementById(`conv-${data.conversationSid}`);
  
    if (existingConversation) {
      console.log('Conversation already exists, updating:', data.conversationSid);
      updateConversationPreview(data.conversationSid, {
        body: data.lastMessage,
        dateCreated: new Date().toISOString(),
      });
      moveConversationToTop(data.conversationSid);
      return;
    }
  
    const displayName = data.friendlyName || data.conversationSid;
    const lastMessageTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lastMessageText = data.lastMessage || 'No messages yet';
  
    const newConversationHtml = `
      <div class="conversation" id="conv-${data.conversationSid}" onclick="selectConversation('${data.conversationSid}', '${displayName}')">
        <div class="conversation-header">
          <div class="header-left">
            <div class="unread-indicator">
              <!-- Unread badge will be inserted here if needed -->
            </div>
            <strong>${displayName}</strong>
          </div>
          <div class="header-right">
            <span class="time">${lastMessageTime}</span>
            <button class="delete-btn" data-sid="${data.conversationSid}" aria-label="Delete Conversation">🗑️</button>
          </div>
        </div>
        <div class="conversation-content">
          <div class="last-message">${lastMessageText}</div>
        </div>
      </div>
    `;
    
    conversationsDiv.insertAdjacentHTML('afterbegin', newConversationHtml);
    attachDeleteListeners();
  }
  
function appendMessage(message) {
  const messagesContainer = document.getElementById('messages');

  const messageClass = message.author === TWILIO_PHONE_NUMBER ? 'right' : 'left';
  const messageHtml = `
    <div class="message ${messageClass}">
      <span>${message.body}</span>
      <time>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
    </div>
  `;
  messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateConversationPreview(conversationSid, latestMessage) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);

  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    const timeDiv = conversationDiv.querySelector('.time');
    if (lastMessageDiv && latestMessage) {
      lastMessageDiv.textContent = latestMessage.body;
      if (timeDiv) {
        timeDiv.textContent = new Date(latestMessage.dateCreated).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
  } else {
    console.log(`Conversation preview not found for SID: ${conversationSid}`);
    // If the conversation doesn't exist, we might want to add it
    handleNewConversation({
      conversationSid: conversationSid,
      friendlyName: 'New Conversation',
      lastMessage: latestMessage.body,
    });
  }
}

function moveConversationToTop(conversationSid) {
  const conversationsDiv = document.getElementById('conversations');
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv && conversationsDiv.firstChild !== conversationDiv) {
    conversationsDiv.insertBefore(conversationDiv, conversationsDiv.firstChild);
  }
}

function loadConversations() {
  document.getElementById('loading-spinner').style.display = 'block';

  axios
    .get('/conversations')
    .then((response) => {
      const conversations = response.data;

      conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

      const conversationsDiv = document.getElementById('conversations');
      conversationsDiv.innerHTML = ''; // Clear existing conversations

      conversations.forEach((conversation) => {
        const lastMessageTime = new Date(conversation.lastMessageTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        let displayName = conversation.friendlyName || conversation.sid;
        if (displayName.startsWith('Conversation with ')) {
          displayName = displayName.replace('Conversation with ', '');
        }

        const lastMessageText = conversation.lastMessage ? conversation.lastMessage : 'No messages yet';
        const conversationHtml = `
          <div class="conversation" id="conv-${conversation.sid}" onclick="selectConversation('${conversation.sid}', '${displayName}')">
            <div class="conversation-header">
              <div class="header-left">
                <strong>${displayName}</strong>
                <span>${conversation.phoneNumber || ''}</span>
              </div>
              <div class="header-right">
                <span class="time">${lastMessageTime}</span>
                <button class="delete-btn" data-sid="${conversation.sid}" aria-label="Delete Conversation">🗑️</button>
              </div>
            </div>
            <div class="conversation-content">
              <div class="last-message">${lastMessageText}</div>
            </div>
          </div>
        `;

        conversationsDiv.insertAdjacentHTML('beforeend', conversationHtml);
      });

      attachDeleteListeners();

      if (currentConversationSid) {
        document.getElementById(`conv-${currentConversationSid}`)?.classList.add('selected');
      }

      conversationsLoaded = true;
    })
    .catch((error) => {
      console.error('Error loading conversations:', error);
    })
    .finally(() => {
      document.getElementById('loading-spinner').style.display = 'none';
    });
}

// Helper function to attach delete listeners
function attachDeleteListeners() {
  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const sid = event.target.getAttribute('data-sid');
      deleteConversation(sid);
    });
  });
}

async function selectConversation(sid, displayName) {
    if (!conversationsLoaded) {
      alert('Please wait until conversations are fully loaded.');
      return;
    }
  
    currentConversationSid = sid;
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('messages').style.display = 'none';
    document.getElementById('message-input').style.display = 'none';
    document.getElementById('messages-title').style.display = 'flex';
    document.getElementById('no-conversation').style.display = 'none';
  
    // Clear unread indicator
    const conversationDiv = document.getElementById(`conv-${sid}`);
    if (conversationDiv) {
      conversationDiv.classList.remove('unread');
      const unreadIndicator = conversationDiv.querySelector('.unread-indicator');
      if (unreadIndicator) {
        unreadIndicator.innerHTML = ''; // Clear the unread badge
      }
    }
  
    try {
      // Deselect other conversations
      document.querySelectorAll('.conversation').forEach((conv) => {
        conv.classList.remove('selected');
      });
      document.getElementById(`conv-${sid}`).classList.add('selected');
  
      // Fetch conversation details
      const response = await axios.get(`/conversations/${sid}`);
      const conversation = response.data;
      const attributes = conversation.attributes || {};
      const name = attributes.name || displayName;
      const email = attributes.email || '';
      const phoneNumber = attributes.phoneNumber || '';
  
      // Inject the conversation header and call controls
      document.getElementById('messages-title').innerHTML = `
      <div class="conversation-info">
        <strong class="contact-name">${name}</strong>
        <span class="contact-phone">${phoneNumber}</span>
        <a class="contact-email" href="mailto:${email}">${email}</a>
      </div>
      <div class="header-controls">
        <div id="call-controls">
          <button id="call-btn" aria-label="Start Call" title="Start Call">
            <i class="fas fa-phone"></i>
          </button>
          <button id="mute-btn" aria-label="Mute Call" title="Mute Call" style="display: none;">
            <i class="fas fa-microphone-slash"></i>
          </button>
          <button id="end-call-btn" aria-label="End Call" title="End Call" style="display: none;">
            <i class="fas fa-phone-slash"></i>
          </button>
          <span id="call-status"></span>
        </div>
        <button class="close-button" onclick="closeConversation()" aria-label="Close Conversation">✕</button>
      </div>
    `;
      // Initialize callStatusElement
      callStatusElement = document.getElementById('call-status');
  
      // Attach event listeners for the call controls
      document.getElementById('call-btn').addEventListener('click', makeCall);
      document.getElementById('mute-btn').addEventListener('click', toggleMute);
      document.getElementById('end-call-btn').addEventListener('click', endCall);
  
      // Show the messages title
      document.getElementById('messages-title').style.display = 'flex';
      document.getElementById('no-conversation').style.display = 'none';
  
      await loadMessages(sid, name);
      document.getElementById('messages').style.display = 'block';
      document.getElementById('message-input').style.display = 'flex';
  
      scrollToBottom('messages');
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      document.getElementById('loading-spinner').style.display = 'none';
    }
  }

async function loadMessages(sid, displayName) {
  try {
    const response = await axios.get(`/conversations/${sid}/messages`);
    const messages = response.data;

    const messagesContainer = document.getElementById('messages');
    const messageList = messages
      .map((message) => {
        const author = message.author.trim();
        const displayAuthor = author.startsWith('CH') ? displayName : author;
        const messageClass = author === TWILIO_PHONE_NUMBER ? 'right' : 'left';
        return `
          <div class="message ${messageClass}">
            <span>${message.body}</span>
            <time>${new Date(message.dateCreated).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}</time>
          </div>
        `;
      })
      .join('');

    messagesContainer.innerHTML = messageList;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      updateConversationPreview(sid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Conversation ${sid} was not found, it may have been deleted.`);
      closeConversation();
    } else {
      console.error(`Error fetching messages for conversation ${sid}:`, error);
    }
  }
}

function scrollToBottom(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
}

function sendMessage() {
  const inputField = document.getElementById('new-message');
  const message = inputField.value.trim();

  if (message === '') {
    return; // Don't send an empty message
  }

  axios
    .post(`/conversations/${currentConversationSid}/messages`, {
      message: message,
    })
    .then((response) => {
      inputField.value = ''; // Clear the input field after sending the message
      console.log('Message sent:', response.data);
      // Don't append the message here. Let the WebSocket handle it.
    })
    .catch((error) => {
      console.error('Error sending message:', error);
    });
}

document.getElementById('new-message').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

function deleteConversation(sid) {
  if (!conversationsLoaded) {
    alert('Please wait until conversations are fully loaded.');
    return;
  }

  if (confirm('Are you sure you want to delete this conversation?')) {
    if (prompt("Type 'CONFIRM_DELETE' to confirm.") === 'CONFIRM_DELETE') {
      try {
        axios
          .delete(`/conversations/${sid}`, { data: { confirmToken: 'CONFIRM_DELETE' } })
          .then(() => {
            console.log(`Conversation ${sid} deleted successfully.`);
            loadConversations(); // Refresh the conversation list after deletion
            if (currentConversationSid === sid) {
              closeConversation();
            }
          });
      } catch (error) {
        alert('Failed to delete conversation. Please try again later.');
        console.error('Error deleting conversation:', error);
      }
    }
  }
}

function closeConversation() {
    currentConversationSid = null;
    document.getElementById('messages-title').innerHTML = '';
    document.getElementById('messages-title').style.display = 'none';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('message-input').style.display = 'none';
    document.getElementById('no-conversation').style.display = 'flex';
  
    // Deselect conversations
    document.querySelectorAll('.conversation').forEach((conv) => {
      conv.classList.remove('selected');
    });
  
    // Reload conversations to update previews
    loadConversations();
  // Fetch the latest message for the closed conversation
  axios.get(`/conversations/${lastConversationSid}/messages?limit=1&order=desc`)
    .then(response => {
      const messages = response.data;
      const latestMessage = messages[0];
      if (latestMessage) {
        updateConversationPreview(lastConversationSid, latestMessage);
      }
    })
    .catch(error => {
      console.error('Error fetching latest message:', error);
    });
}

// Call controls

function updateCallControls(isInCall) {
    const callButton = document.getElementById('call-btn');
    const muteButton = document.getElementById('mute-btn');
    const endCallButton = document.getElementById('end-call-btn');
  
    if (callButton && muteButton && endCallButton) {
      if (isInCall) {
        callButton.style.display = 'none';
        muteButton.style.display = 'inline-block';
        endCallButton.style.display = 'inline-block';
      } else {
        callButton.style.display = 'inline-block';
        muteButton.style.display = 'none';
        endCallButton.style.display = 'none';
      }
    }
  }

async function setupDevice() {
  try {
    console.log('Fetching token from server...');
    const response = await axios.get(`${NGROK_URL}/token`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    console.log('Token response:', response.data);

    if (!response.data || !response.data.token) {
      throw new Error('No token received from server');
    }

    console.log('Initializing Twilio.Device...');
    device = new Twilio.Device(response.data.token, {
      codecPreferences: ['opus', 'pcmu'],
      fakeLocalDTMF: true,
      debug: true,
      enableRingingState: true,
    });

    device.on('ready', function () {
      console.log('Twilio.Device Ready!');
    });

    device.on('error', function (error) {
      console.error('Twilio.Device Error:', error);
    });

    device.on('disconnect', function () {
      console.log('Call ended.');
      updateCallStatus('Call ended');
      stopCallDurationTimer();
      setTimeout(() => {
        updateCallStatus('');
      }, 3000);
    });

    console.log('Twilio.Device setup complete');
  } catch (error) {
    console.error('Error setting up Twilio device:', error);
    throw error;
  }
}

async function makeCall() {
    if (!currentConversationSid) {
      alert('Please select a conversation before making a call.');
      return;
    }
  
    if (call && call.status() === 'open') {
      alert('You are already in a call.');
      return;
    }
  
    try {
      if (!device) {
        console.log('Twilio Device not set up. Attempting to set up...');
        await setupDevice();
      }
  
      console.log('Fetching call parameters...');
      const response = await axios.get(`${NGROK_URL}/call-params/${currentConversationSid}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const params = response.data;
      console.log('Call parameters:', params);
  
      console.log('Initiating call...');
      call = device.connect({ To: params.To, From: params.From });
      updateCallStatus('Calling...');
  
      // Set up event handlers for the call
      call.on('accept', () => {
        console.log('Call accepted');
        updateCallStatus('In call');
        startCallDurationTimer();
  
        updateCallControls(true); // Hide call button, show mute and end call buttons
      });
  
      call.on('disconnect', () => {
        console.log('Call disconnected');
        updateCallStatus('Call ended');
        stopCallDurationTimer();
  
        updateCallControls(false); // Show call button, hide mute and end call buttons
      });
  
      call.on('error', (error) => {
        console.error('Call error:', error);
        updateCallStatus('Call error');
      });
  
    } catch (error) {
      console.error('Error making call:', error);
      if (error.response) {
        console.error('Server responded with:', error.response.data);
      }
      alert('Failed to initiate call. Please check the console for more details.');
    }
  }

function toggleMute() {
  if (call) {
    isMuted = !isMuted;
    call.mute(isMuted);
    const muteButtonIcon = document.getElementById('mute-btn').querySelector('i');
    if (isMuted) {
      console.log('Call muted');
      muteButtonIcon.classList.remove('fa-microphone-slash');
      muteButtonIcon.classList.add('fa-microphone');
    } else {
      console.log('Call unmuted');
      muteButtonIcon.classList.remove('fa-microphone');
      muteButtonIcon.classList.add('fa-microphone-slash');
    }
  }
}

function endCall() {
    if (call) {
      call.disconnect();
      updateCallControls(false); // Show call button, hide mute and end call buttons
      updateCallStatus('Call ended');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await initializeApp();
      loadConversations();
      setupWebSocket();
      
      // Hide messages title and show 'No conversation selected' message
      document.getElementById('messages-title').style.display = 'none';
      document.getElementById('no-conversation').style.display = 'flex';
      
      // Clear any existing conversation details
      document.getElementById('messages').innerHTML = '';
      document.getElementById('message-input').style.display = 'none';
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  });

// Additional functions for call duration and status updates
let callStartTime;
let callDurationInterval;

function startCallDurationTimer() {
  callStartTime = new Date();
  callDurationInterval = setInterval(updateCallDuration, 1000);
}

function stopCallDurationTimer() {
  clearInterval(callDurationInterval);
}

function updateCallDuration() {
  const now = new Date();
  const duration = now - callStartTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
  updateCallStatus(`In call - ${formattedDuration}`);
}

function updateCallStatus(status) {
    if (callStatusElement) {
      callStatusElement.textContent = status;
  
      // Remove existing status classes
      callStatusElement.classList.remove('calling', 'in-call', 'call-ended', 'call-error');
  
      // Add the appropriate class
      if (status.toLowerCase().includes('calling')) {
        callStatusElement.classList.add('calling');
      } else if (status.toLowerCase().includes('in call')) {
        callStatusElement.classList.add('in-call');
      } else if (status.toLowerCase().includes('call ended')) {
        callStatusElement.classList.add('call-ended');
      } else if (status.toLowerCase().includes('error')) {
        callStatusElement.classList.add('call-error');
      }
    } else {
      console.warn('Call status element not found');
    }
  }

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', currentTheme);
}

// Event listeners for theme toggle and new conversation button
document.getElementById('theme-toggle-btn').addEventListener('click', function () {
  toggleTheme();
  const currentIcon = document.body.getAttribute('data-theme') === 'dark' ? '🌞' : '🌜';
  this.textContent = currentIcon;
});

document.getElementById('new-conversation-btn').addEventListener('click', function () {
  document.getElementById('new-conversation-modal').style.display = 'flex';
});

function closeModal() {
  document.getElementById('new-conversation-modal').style.display = 'none';
}

function startConversation(event) {
  event.preventDefault();
  const form = event.target;
  const phoneNumber = form.phoneNumber.value.trim();
  const message = form.message.value.trim();
  const name = form.name.value.trim();
  const email = form.email.value.trim();

  if (phoneNumber && message) {
    axios
      .post('/start-conversation', { phoneNumber, message, name, email })
      .then(async (response) => {
        if (response.data.existing) {
          const userConfirmed = confirm(
            'This conversation already exists. Would you like to open it?'
          );
          if (userConfirmed) {
            closeModal(); // Close modal after selecting existing conversation
            selectConversation(response.data.sid, phoneNumber);
          }
        } else {
          form.reset();
          await loadConversations();
          closeModal();
          selectConversation(response.data.sid, phoneNumber);
        }
      })
      .catch((error) => {
        console.error('Error starting conversation:', error);
        alert('Failed to start a new conversation. Please try again.');
      });
  } else {
    alert('Please enter both a phone number and a message.');
  }
}