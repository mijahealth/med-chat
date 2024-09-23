// public/client.js

// **Initialization and Configuration**

let currentConversationSid = null;
let currentTheme = 'light';
let autoScrollEnabled = true;
let conversationsLoaded = false;
let userInteracted = false;
let call = null;
let isMuted = false;

// Configuration variables
let TWILIO_PHONE_NUMBER = '';
let NGROK_URL = '';

// Twilio Device for calls
let device = null;

// Call status element
let callStatusElement = null;

// WebSocket connection
let socket = null;

// **Future Enhancements**
const appConfig = {
  user: null, // Placeholder for future multi-user support
  tenant: null, // Placeholder for future multi-tenancy support
};

// **Utility Functions**

function log(message, data = {}) {
  console.log(`[LOG] ${message}`, data);
}

// Format time for display
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// **Initialization Function**

async function initializeApp() {
  try {
    // Fetch configuration from the server
    const response = await axios.get('/config');
    TWILIO_PHONE_NUMBER = response.data.TWILIO_PHONE_NUMBER;
    NGROK_URL = response.data.NGROK_URL;

    setupEventListeners();
    await loadConversations();
    setupWebSocket();
    setupSearch();
    showNoConversationSelected();
  } catch (error) {
    log('Error initializing app', { error });
  }
  feather.replace(); // Replace all Feather icons after the app is initialized
}

// **Event Listeners**

function setupEventListeners() {
  // User interaction tracking for sound notifications
  document.addEventListener('click', () => {
    userInteracted = true;
  });

  // Theme Toggle Button
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  } else {
    log('Theme toggle button not found');
  }

  // New Conversation Button
  const newConversationBtn = document.getElementById('new-conversation-btn');
  if (newConversationBtn) {
    newConversationBtn.innerHTML = '<i data-feather="plus" aria-hidden="true"></i>';
    newConversationBtn.addEventListener('click', openNewConversationModal);
    feather.replace(); // Replace the new conversation button icon
  } else {
    log('New conversation button not found');
  }

  // Attach event listener to the new conversation form
  const newConversationForm = document.getElementById('new-conversation-form');
  if (newConversationForm) {
    newConversationForm.addEventListener('submit', startConversation);
  } else {
    log('New conversation form not found');
  }

  // Send Message on Enter
  const newMessageInput = document.getElementById('new-message');
  if (newMessageInput) {
    newMessageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  } else {
    log('New message input field not found');
  }

  // Scroll Event for Auto-Scroll
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv) {
    messagesDiv.addEventListener('scroll', checkScrollPosition);
  } else {
    log('Messages div not found');
  }
  // **Add the video call button listener here**
  const startVideoCallBtn = document.getElementById('start-video-call-btn');
  if (startVideoCallBtn) {
    startVideoCallBtn.addEventListener('click', startVideoCall); // Your new video call button listener
  } else {
    log('Start video call button not found');
  }
}

async function startVideoCall() {
  try {
    const conversationSid = currentConversationSid;
    const phoneElement = document.querySelector('.contact-item span');
    
    if (!phoneElement) {
      throw new Error('Phone number element not found');
    }

    const customerPhoneNumber = phoneElement.textContent.trim();
    console.log('Retrieved phone number:', customerPhoneNumber);

    if (!/^\+[1-9]\d{1,14}$/.test(customerPhoneNumber)) {
      throw new Error(`Invalid phone number format: ${customerPhoneNumber}`);
    }

    const response = await axios.post('/create-room', { customerPhoneNumber, conversationSid });
    const { link, roomName } = response.data;

    console.log('Room link:', link);
    
    // Open the video room in a new window or tab
    window.open(`/video-room/${roomName}`, '_blank');
  } catch (error) {
    console.error('Error starting video call:', error);
    alert('Failed to start video call. Please try again.');
  }
}

// **WebSocket Handling**

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    log('WebSocket connection established');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    log('Received WebSocket message', data);

    switch (data.type) {
      case 'newMessage':
        handleNewMessage(data);
        break;
      case 'newConversation':
        handleNewConversation(data);
        break;
      case 'updateConversation':
        handleUpdateConversation(data);
        break;
      default:
        log('Unknown WebSocket message type', data);
    }
  };

  socket.onclose = () => {
    log('WebSocket connection closed');
    setTimeout(setupWebSocket, 5000); // Attempt to reconnect after 5 seconds
  };

  socket.onerror = (error) => {
    log('WebSocket error', { error });
  };
}

// **Conversation Management**

async function loadConversations() {
  document.getElementById('loading-spinner').style.display = 'block';

  try {
    const response = await axios.get('/conversations');
    const conversations = response.data;

    // Sort conversations by newest first
    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    const conversationsDiv = document.getElementById('conversations');
    conversationsDiv.innerHTML = ''; // Clear existing conversations

    conversations.forEach((conversation) => {
      addConversationToList(conversation);
    });

    attachDeleteListeners();

    if (currentConversationSid) {
      document.getElementById(`conv-${currentConversationSid}`)?.classList.add('selected');
    }

    conversationsLoaded = true;
  } catch (error) {
    log('Error loading conversations', { error });
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
  }
}

function addConversationToList(conversation) {
  const conversationsDiv = document.getElementById('conversations');
  const lastMessageTime = formatTime(conversation.lastMessageTime);
  let displayName = conversation.friendlyName || conversation.sid;
  displayName = displayName.replace('Conversation with ', '');

  const lastMessageText = conversation.lastMessage || 'No messages yet';
  const unreadBadge = conversation.unreadCount > 0
    ? `<span class="unread-badge">${conversation.unreadCount}</span>`
    : '<span class="unread-indicator"></span>';

    const conversationHtml = `
    <div class="conversation ${conversation.unreadCount > 0 ? 'unread' : ''}" id="conv-${conversation.sid}" onclick="selectConversation('${conversation.sid}', '${displayName}')">
      <div class="conversation-header">
        <div class="unread-indicator-column">
          ${unreadBadge}
        </div>
        <div class="conversation-details">
          <div class="header-left">
            <strong>${displayName}</strong>
            <span class="phone-number">${conversation.attributes?.phoneNumber || ''}</span>
          </div>
          <div class="header-right">
            <span class="time">${lastMessageTime}</span>
            <button class="delete-btn" data-sid="${conversation.sid}" aria-label="Delete Conversation">
              <i data-feather="trash-2" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="conversation-content">
        <div class="last-message">${lastMessageText}</div>
      </div>
    </div>
  `;

  conversationsDiv.insertAdjacentHTML('beforeend', conversationHtml);
  feather.replace(); // Replace the newly added icon
}

function attachDeleteListeners() {
  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const sid = event.currentTarget.getAttribute('data-sid');
      deleteConversation(sid);
    });
  });
}

async function selectConversation(sid, displayName) {
  console.log(`Selecting conversation with SID: ${sid}`);
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

  try {
    // Deselect other conversations
    document.querySelectorAll('.conversation').forEach((conv) => {
      conv.classList.remove('selected');
    });
    const selectedConversation = document.getElementById(`conv-${sid}`);
    selectedConversation.classList.add('selected');

    // Remove unread indicators immediately
    if (selectedConversation) {
      selectedConversation.classList.remove('unread');
      const unreadBadge = selectedConversation.querySelector('.unread-badge');
      if (unreadBadge) {
        unreadBadge.remove();
      }
    }

    // Fetch conversation details
    const response = await axios.get(`/conversations/${sid}`);
    const conversation = response.data;
    const attributes = conversation.attributes || {};

    // Conditionally call mark-read without awaiting
    if (conversation.unreadCount > 0) {
      axios.post(`/conversations/${sid}/mark-read`).catch((error) => {
        log('Error marking messages as read', { error: error });
      });
    }

    const name = attributes.name || displayName;
    const email = attributes.email || '';
    const phoneNumber = attributes.phoneNumber || '';
    const dob = attributes.dob || '';
    const state = attributes.state || '';

    // Inject the conversation header and call controls
    setupConversationHeader(sid, name, email, phoneNumber, dob, state);

    await loadMessages(sid, name);
    document.getElementById('messages').style.display = 'block';
    document.getElementById('message-input').style.display = 'flex';

    scrollToBottom('messages');

  } catch (error) {
    if (error.response) {
      log('Error loading conversation', { error: error.response.data });
      alert(`Error: ${error.response.data.error || 'Unknown error occurred.'}`);
    } else {
      log('Error loading conversation', { error: error.message });
      alert(`Error: ${error.message}`);
    }
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
  }
}

function setupConversationHeader(sid, name, email, phoneNumber, dob, state) {
  document.getElementById('messages-title').innerHTML = `
    <div class="contact-card-wrapper">
      <div class="contact-card">
        <div class="contact-card-avatar">
          <i data-feather="user" class="icon avatar-icon"></i>
        </div>
        <div class="contact-card-content">
          <div class="contact-card-main">
            <h2 class="contact-name">${name}</h2>
            <div class="contact-card-details">
              <div class="contact-info-row">
                <div class="contact-item">
                  <i data-feather="phone" class="icon contact-icon"></i>
                  <span>${phoneNumber}</span>
                </div>
                <div class="contact-item">
                  <i data-feather="mail" class="icon contact-icon"></i>
                  <a href="mailto:${email}" target="_blank" rel="noopener noreferrer">${email}</a>
                </div>
              </div>
              <div class="contact-info-row">
                <div class="contact-item">
                  <i data-feather="calendar" class="icon contact-icon"></i>
                  <span>DOB: ${dob}</span>
                </div>
                <div class="contact-item">
                  <i data-feather="map-pin" class="icon contact-icon"></i>
                  <span>State: ${state}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="header-controls">
        <div id="call-controls">
          <button id="call-btn" aria-label="Start Call" title="Start Call">
            <i data-feather="phone-call"></i>
          </button>
          <button id="start-video-call-btn" aria-label="Start Video Call" title="Start Video Call">
            <i data-feather="video"></i>
          </button>
          <button id="mute-btn" aria-label="Mute Call" title="Mute Call" style="display: none;">
            <i data-feather="mic-off"></i>
          </button>
          <button id="end-call-btn" aria-label="End Call" title="End Call" style="display: none;">
            <i data-feather="phone-off"></i>
          </button>
          <span id="call-status"></span>
        </div>
        <button class="close-button" onclick="closeConversation()" aria-label="Close Conversation">
          <i data-feather="x"></i>
        </button>
      </div>
    </div>
  `;

  // Initialize callStatusElement
  callStatusElement = document.getElementById('call-status');

  // Attach event listeners for the call controls
  document.getElementById('call-btn').addEventListener('click', makeCall);
  document.getElementById('start-video-call-btn').addEventListener('click', startVideoCall); // Add event listener for the video button
  document.getElementById('mute-btn').addEventListener('click', toggleMute);
  document.getElementById('end-call-btn').addEventListener('click', endCall);

  // Replace Feather Icons placeholders with actual icons
  feather.replace();
}

function closeConversation(wasDeleted = false) {
  const lastConversationSid = currentConversationSid;
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

  // Fetch the latest message if the conversation wasn't deleted
  if (lastConversationSid && !wasDeleted) {
    updateLatestMessagePreview(lastConversationSid);
  }
}

async function updateLatestMessagePreview(conversationSid) {
  try {
    const response = await axios.get(`/conversations/${conversationSid}/messages?limit=1&order=desc`);
    const messages = response.data;
    const latestMessage = messages[0];
    if (latestMessage) {
      updateConversationPreview(conversationSid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      log(`Conversation ${conversationSid} not found, it may have been deleted.`);
    } else {
      log('Error fetching latest message', { error });
    }
  }
}

async function deleteConversation(sid) {
  if (!conversationsLoaded) {
    alert('Please wait until conversations are fully loaded.');
    return;
  }

  if (confirm('Are you sure you want to delete this conversation?')) {
    if (prompt("Type 'CONFIRM_DELETE' to confirm.") === 'CONFIRM_DELETE') {
      try {
        await axios.delete(`/conversations/${sid}`, { data: { confirmToken: 'CONFIRM_DELETE' } });
        log(`Conversation ${sid} deleted successfully.`);
        // Remove the conversation from the UI immediately
        const conversationElement = document.getElementById(`conv-${sid}`);
        if (conversationElement) {
          conversationElement.remove();
        }
        if (currentConversationSid === sid) {
          closeConversation(true); // Pass true to indicate the conversation was deleted
        }
      } catch (error) {
        alert('Failed to delete conversation. Please try again later.');
        log('Error deleting conversation', { error });
      }
    }
  }
}

// **Message Handling**

async function loadMessages(sid, displayName) {
  try {
    // Fetch messages with increased limit and ascending order
    const response = await axios.get(`/conversations/${sid}/messages?limit=1000&order=asc`);
    const messages = response.data;

    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = ''; // Clear existing messages

    messages.forEach((message) => {
      appendMessage(message);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      updateConversationPreview(sid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      log(`Conversation ${sid} was not found, it may have been deleted.`);
      closeConversation();
    } else {
      log(`Error fetching messages for conversation ${sid}`, { error });
    }
  }
}

function appendMessage(message) {
  const messagesContainer = document.getElementById('messages');
  const author = message.author.trim();
  const messageClass = author === TWILIO_PHONE_NUMBER ? 'right' : 'left';

  const messageHtml = `
    <div class="message ${messageClass}">
      <span>${message.body}</span>
      <time>${formatTime(message.dateCreated)}</time>
    </div>
  `;
  messagesContainer.insertAdjacentHTML('beforeend', messageHtml);

  // Auto-scroll to bottom if enabled
  if (autoScrollEnabled) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
    .then(() => {
      inputField.value = ''; // Clear the input field after sending the message
      log('Message sent', { message });
      
      // Show message sent indicator
      const indicator = document.getElementById('message-sent-indicator');
      indicator.textContent = 'Message Sent';
      indicator.classList.add('show');
      setTimeout(() => {
        indicator.classList.remove('show');
      }, 3000); // Hide after 3 seconds
    })
    .catch((error) => {
      log('Error sending message', { error });
      
      // Show error message to the user
      const indicator = document.getElementById('message-sent-indicator');
      indicator.textContent = 'Failed to send message';
      indicator.classList.add('show', 'error');
      setTimeout(() => {
        indicator.classList.remove('show', 'error');
      }, 3000); // Hide after 3 seconds
    });
}

function handleNewMessage(data) {
  console.log('Handling new message:', data);
  // Play notification sound if the message is not from us
  if (data.author !== TWILIO_PHONE_NUMBER) {
    playNotificationSound();
  }

  // Ensure dateCreated is properly set
  if (!data.dateCreated) {
    data.dateCreated = new Date().toISOString();
  }

  if (currentConversationSid === data.conversationSid) {
    appendMessage(data);
  } else {
    // Only increment unread count for messages not from us
    if (data.author !== TWILIO_PHONE_NUMBER) {
      incrementUnreadCount(data.conversationSid);
    }
  }

  // Update preview for all messages
  updateConversationPreview(data.conversationSid, {
    body: data.body,
    author: data.author,
    dateCreated: data.dateCreated,
  });

  moveConversationToTop(data.conversationSid);
}

function updateConversationPreview(conversationSid, latestMessage) {
  console.log('Updating conversation preview:', conversationSid, latestMessage);
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);

  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    const timeDiv = conversationDiv.querySelector('.time');
    if (lastMessageDiv && latestMessage) {
      lastMessageDiv.textContent = latestMessage.body;
      if (timeDiv) {
        timeDiv.textContent = formatTime(latestMessage.dateCreated);
      }
    }
  } else {
    log(`Conversation preview not found for SID: ${conversationSid}`);
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

function markConversationAsUnread(conversationSid) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    conversationDiv.classList.add('unread');
    let unreadBadge = conversationDiv.querySelector('.unread-badge');
    if (unreadBadge) {
      const currentCount = parseInt(unreadBadge.textContent) || 0;
      unreadBadge.textContent = currentCount + 1;
    } else {
      conversationDiv.querySelector('.unread-indicator-column').innerHTML = `
        <span class="unread-badge">1</span>
      `;
    }
  }
}

function handleNewConversation(data) {
  const existingConversation = document.getElementById(`conv-${data.conversationSid}`);

  if (existingConversation) {
    log('Conversation already exists, updating', { conversationSid: data.conversationSid });
    updateConversationPreview(data.conversationSid, {
      body: data.lastMessage,
      dateCreated: new Date().toISOString(),
    });
    moveConversationToTop(data.conversationSid);
    return;
  }

  const displayName = data.friendlyName || data.conversationSid;
  const lastMessageTime = formatTime(new Date().toISOString());
  const lastMessageText = data.lastMessage || 'No messages yet';
  const attributes = data.attributes || {};

  const newConversationHtml = `
    <div class="conversation" id="conv-${data.conversationSid}" onclick="selectConversation('${data.conversationSid}', '${displayName}')">
      <div class="conversation-header">
        <div class="unread-indicator-column">
          <div class="unread-indicator"></div>
        </div>
        <div class="conversation-details">
          <div class="header-left">
            <strong>${displayName}</strong>
          </div>
          <div class="header-right">
            <span class="time">${lastMessageTime}</span>
            <button class="delete-btn" data-sid="${data.conversationSid}" aria-label="Delete Conversation">🗑️</button>
          </div>
        </div>
      </div>
      <div class="conversation-content">
        <div class="last-message">${lastMessageText}</div>
      </div>
    </div>
  `;

  const conversationsDiv = document.getElementById('conversations');
  conversationsDiv.insertAdjacentHTML('afterbegin', newConversationHtml);
  attachDeleteListeners();

  // Store the full details in a data attribute for use when selecting the conversation
  const conversationElement = document.getElementById(`conv-${data.conversationSid}`);
  conversationElement.dataset.fullDetails = JSON.stringify(attributes);
}

function handleUpdateConversation(data) {
  const conversationDiv = document.getElementById(`conv-${data.conversationSid}`);
  if (conversationDiv) {
    // Update the friendly name
    const nameElement = conversationDiv.querySelector('strong');
    if (nameElement) {
      nameElement.textContent = data.friendlyName;
    }

    // Update the last message
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    if (lastMessageDiv) {
      lastMessageDiv.textContent = data.lastMessage;
    }

    // Update the time
    const timeDiv = conversationDiv.querySelector('.time');
    if (timeDiv) {
      timeDiv.textContent = formatTime(data.lastMessageTime);
    }

    // Update the stored attributes
    conversationDiv.dataset.fullDetails = JSON.stringify(data.attributes);

    // Move the conversation to the top of the list
    moveConversationToTop(data.conversationSid);

    // Don't mark as unread or increment count here
  }
}

function incrementUnreadCount(conversationSid) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    conversationDiv.classList.add('unread');
    let unreadBadge = conversationDiv.querySelector('.unread-badge');
    if (unreadBadge) {
      const currentCount = parseInt(unreadBadge.textContent) || 0;
      unreadBadge.textContent = currentCount + 1;
    } else {
      conversationDiv.querySelector('.unread-indicator-column').innerHTML = `
        <span class="unread-badge">1</span>
      `;
    }
  }
}

// **Call Functionality**

async function setupDevice() {
  try {
    log('Fetching token from server...');
    const identity = 'user_' + Date.now();  // Generate a unique identity
    const response = await axios.get(`${NGROK_URL}/token`, {
      params: { identity: identity },
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.data || !response.data.token) {
      throw new Error('No token received from server');
    }

    device = new Twilio.Device(response.data.token, {
      codecPreferences: ['opus', 'pcmu'],
      fakeLocalDTMF: true,
      debug: true,
      enableRingingState: true,
    });

    device.on('ready', () => {
      log('Twilio.Device Ready!');
    });

    device.on('error', (error) => {
      log('Twilio.Device Error', { error });
    });

    device.on('disconnect', () => {
      log('Call ended.');
      updateCallStatus('Call ended');
      stopCallDurationTimer();
      setTimeout(() => {
        updateCallStatus('');
      }, 3000);
    });

    log('Twilio.Device setup complete');
  } catch (error) {
    log('Error setting up Twilio device', { error });
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
      log('Twilio Device not set up. Attempting to set up...');
      await setupDevice();
    }

    log('Fetching call parameters...');
    const response = await axios.get(`${NGROK_URL}/call-params/${currentConversationSid}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    const params = response.data;

    // Send SMS notification
    const smsMessage = `Your provider is going to call you from ${params.From} in 5 seconds.`;
    await axios.post(`/conversations/${currentConversationSid}/messages`, {
      message: smsMessage
    });
    
    log('SMS notification sent. Waiting 5 seconds before initiating call...');
    updateCallStatus('Notifying patient...');

    // Wait for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    log('Initiating call...');
    call = device.connect({ To: params.To, From: params.From });
    updateCallStatus('Calling...');

    // Set up event handlers for the call
    call.on('accept', () => {
      log('Call accepted');
      updateCallStatus('In call');
      startCallDurationTimer();

      updateCallControls(true); // Hide call button, show mute and end call buttons
    });

    call.on('disconnect', () => {
      log('Call disconnected');
      updateCallStatus('Call ended');
      stopCallDurationTimer();

      updateCallControls(false); // Show call button, hide mute and end call buttons
    });

    call.on('error', (error) => {
      log('Call error', { error });
      updateCallStatus('Call error');
    });

  } catch (error) {
    log('Error making call', { error });
    if (error.response) {
      log('Server responded with', { data: error.response.data });
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
      log('Call muted');
      muteButtonIcon.classList.remove('fa-microphone-slash');
      muteButtonIcon.classList.add('fa-microphone');
    } else {
      log('Call unmuted');
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
    log('Call status element not found');
  }
}

// **UI Helpers**

function showNoConversationSelected() {
  document.getElementById('messages-title').style.display = 'none';
  document.getElementById('no-conversation').style.display = 'flex';

  // Clear any existing conversation details
  document.getElementById('messages').innerHTML = '';
  document.getElementById('message-input').style.display = 'none';
}

function scrollToBottom(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
}

function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10) {
    autoScrollEnabled = true;
  } else {
    autoScrollEnabled = false;
  }
}

function playNotificationSound() {
  if (userInteracted) {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch((error) => {
      log('Error playing sound', { error });
    });
  } else {
    log('User hasn\'t interacted with the page yet. Sound not played.');
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', currentTheme);
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  themeToggleBtn.innerHTML = `<i data-feather="${currentTheme === 'dark' ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
  feather.replace(); // Replace the theme toggle icon
}

// **New Conversation Modal**

function openNewConversationModal() {
  clearNewConversationForm();
  document.getElementById('new-conversation-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('new-conversation-modal').style.display = 'none';
}

function clearNewConversationForm() {
  const form = document.querySelector('#new-conversation-modal form');
  if (form) {
    form.reset();
  }
}

function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  const timestamp = date.getTime();

  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return false;
  }

  return date.toISOString().startsWith(dateString);
}

function startConversation(event) {
  event.preventDefault();
  const form = event.target;
  const phoneNumber = form.phoneNumber.value.trim();
  const message = form.message.value.trim();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const dob = form.dob.value.trim();
  const state = form.state.value.trim();

  // Additional validation
  if (!/^\+[0-9]{10,15}$/.test(phoneNumber)) {
    alert('Please enter a valid phone number in the format +XXXXXXXXXXX');
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  if (dob && !isValidDate(dob)) {
    alert('Please enter a valid date of birth');
    return;
  }

  if (phoneNumber && message && name) {
    axios
      .post('/start-conversation', { phoneNumber, message, name, email, dob, state })
      .then(async (response) => {
        if (response.data.existing) {
          const userConfirmed = confirm(
            'This conversation already exists. Would you like to open it?'
          );
          if (userConfirmed) {
            closeModal();
            selectConversation(response.data.sid, name);
          }
        } else {
          await loadConversations();
          closeModal();
          selectConversation(response.data.sid, name);
        }
        // Clear the form regardless of whether a new conversation was created or not
        clearNewConversationForm();
      })
      .catch((error) => {
        log('Error starting conversation', { error });
        alert('Failed to start a new conversation. Please try again.');
      });
  } else {
    alert('Please fill in all required fields.');
  }
}

// **Search Functionality**

function setupSearch() {
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search-input';
  searchInput.placeholder = 'Search conversations...';
  searchInput.classList.add('search-input');

  const sidebar = document.getElementById('sidebar');
  sidebar.insertBefore(searchInput, sidebar.firstChild);

  searchInput.addEventListener('input', debounce(performSearch, 300));
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function performSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (query === '') {
    await loadConversations(); // Reset to show all conversations
    return;
  }

  try {
    const response = await axios.get(`/search?query=${encodeURIComponent(query)}`);
    const results = response.data;

    const conversationsDiv = document.getElementById('conversations');
    conversationsDiv.innerHTML = ''; // Clear existing conversations

    results.forEach((conversation) => {
      addConversationToList(conversation);
    });

    attachDeleteListeners();

    log(`Search completed. Found ${results.length} results for query: ${query}`);
  } catch (error) {
    log('Error performing search', { error });
  }
}

// **Initialize the App on DOMContentLoaded**

document.addEventListener('DOMContentLoaded', initializeApp);