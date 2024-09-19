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
let userInteracted = false;


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
    } else if (data.type === 'updateConversation') {
      handleUpdateConversation(data);
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

document.addEventListener('click', () => {
    userInteracted = true;
  });


  function handleNewMessage(data) {
    // Play notification sound if the message is not from us
    if (data.author !== TWILIO_PHONE_NUMBER) {
      playNotificationSound();
    }
  
    if (currentConversationSid === data.conversationSid) {
      appendMessage(data);
    } else {
      const conversationDiv = document.getElementById(`conv-${data.conversationSid}`);
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
  
    updateConversationPreview(data.conversationSid, {
      body: data.body,
      author: data.author,
      dateCreated: new Date().toISOString(),
    });
  
    moveConversationToTop(data.conversationSid);
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
        timeDiv.textContent = new Date(data.lastMessageTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
  
      // Update the stored attributes
      conversationDiv.dataset.fullDetails = JSON.stringify(data.attributes);
  
      // Move the conversation to the top of the list
      moveConversationToTop(data.conversationSid);
  
      // If this is not the currently selected conversation, mark it as unread
      if (currentConversationSid !== data.conversationSid) {
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
  }

function playNotificationSound() {
  if (userInteracted) {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch((error) => {
      console.error('Error playing sound:', error);
    });
  } else {
    console.log('User hasn\'t interacted with the page yet. Sound not played.');
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

  // Inserting the new conversation into the conversation list
  conversationsDiv.insertAdjacentHTML('afterbegin', newConversationHtml);
  attachDeleteListeners(); // Ensure delete button works

  // Store the full details in a data attribute for use when selecting the conversation
  const conversationElement = document.getElementById(`conv-${data.conversationSid}`);
  conversationElement.dataset.fullDetails = JSON.stringify(attributes);
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
        const unreadBadge = conversation.unreadCount > 0 
          ? `<span class="unread-badge">${conversation.unreadCount}</span>` 
          : '<span class="unread-indicator"></span>'; // Always include a span for consistent layout

        const conversationHtml = `
        <div class="conversation ${conversation.unreadCount > 0 ? 'unread' : ''}" id="conv-${conversation.sid}" onclick="selectConversation('${conversation.sid}', '${displayName}')">
          <div class="conversation-header">
            <div class="unread-indicator-column">
              ${unreadBadge}
            </div>
            <div class="conversation-details">
              <div class="header-left">
                <strong>${displayName}</strong>
                <span class="phone-number">${conversation.attributes ? conversation.attributes.phoneNumber : ''}</span>
              </div>
              <div class="header-right">
                <span class="time">${lastMessageTime}</span>
                <button class="delete-btn" data-sid="${conversation.sid}" aria-label="Delete Conversation">🗑️</button>
              </div>
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

  try {
    // Deselect other conversations
    document.querySelectorAll('.conversation').forEach((conv) => {
      conv.classList.remove('selected');
    });
    const selectedConversation = document.getElementById(`conv-${sid}`);
    selectedConversation.classList.add('selected');

    // **Remove unread indicators immediately**
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

    // **Conditionally call mark-read without awaiting**
    if (conversation.unreadCount > 0) {
      axios.post(`/conversations/${sid}/mark-read`).catch((error) => {
        console.error('Error marking messages as read:', error);
      });
    }

    const name = attributes.name || displayName;
    const email = attributes.email || '';
    const phoneNumber = attributes.phoneNumber || '';
    const dob = attributes.dob || '';
    const state = attributes.state || '';

    // Inject the conversation header and call controls
    document.getElementById('messages-title').innerHTML = `
      <div class="conversation-info">
        <strong class="contact-name">${name}</strong>
        <span class="contact-phone">${phoneNumber}</span>
        <a class="contact-email" href="mailto:${email}">${email}</a>
        <span class="contact-dob">DOB: ${dob}</span>
        <span class="contact-state">State: ${state}</span>
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

function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10) {
    autoScrollEnabled = true;
  } else {
    autoScrollEnabled = false;
  }
}

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
            // Remove the conversation from the UI immediately
            const conversationElement = document.getElementById(`conv-${sid}`);
            if (conversationElement) {
              conversationElement.remove();
            }
            if (currentConversationSid === sid) {
              closeConversation(true);  // Pass true to indicate the conversation was deleted
            }
          });
      } catch (error) {
        alert('Failed to delete conversation. Please try again later.');
        console.error('Error deleting conversation:', error);
      }
    }
  }
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

  // Only fetch the latest message if the conversation wasn't deleted
  if (lastConversationSid && !wasDeleted) {
      axios.get(`/conversations/${lastConversationSid}/messages?limit=1&order=desc`)
          .then(response => {
              const messages = response.data;
              const latestMessage = messages[0];
              if (latestMessage) {
                  updateConversationPreview(lastConversationSid, latestMessage);
              }
          })
          .catch(error => {
              if (error.response && error.response.status === 404) {
                  console.log(`Conversation ${lastConversationSid} not found, it may have been deleted.`);
                  // Optionally, you can remove the conversation from the UI here
              } else {
                  console.error('Error fetching latest message:', error);
              }
          });
  }
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
  
      // Add scroll event listener to messages div
      const messagesDiv = document.getElementById('messages');
      if (messagesDiv) {
        messagesDiv.addEventListener('scroll', checkScrollPosition);
      }
  
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
  const dob = form.dob.value.trim();

  // Additional validation
  if (!/^\+[0-9]{10,15}$/.test(phoneNumber)) {
    alert('Please enter a valid phone number in the format +XXXXXXXXXXX');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  if (!isValidDate(dob)) {
    alert('Please enter a valid date of birth');
    return;
  }

  if (phoneNumber && message && name && email && dob) {
    axios
      .post('/start-conversation', { phoneNumber, message, name, email, dob })
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
        console.error('Error starting conversation:', error);
        alert('Failed to start a new conversation. Please try again.');
      });
  } else {
    alert('Please fill in all fields.');
  }
}

// Helper function to clear the new conversation form
function clearNewConversationForm() {
  const form = document.querySelector('#new-conversation-modal form');
  if (form) {
    form.reset();
  }
}

// Helper function to validate date
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

// Add this function to clear the form when the modal is opened
function openNewConversationModal() {
  clearNewConversationForm();
  document.getElementById('new-conversation-modal').style.display = 'flex';
}

// Update the event listener for the new conversation button
document.getElementById('new-conversation-btn').addEventListener('click', openNewConversationModal);