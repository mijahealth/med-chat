let currentConversationSid;
let currentTheme = 'light';
let autoScrollEnabled = true;
let conversationsLoaded = false;
let socket;
const NGROK_URL = 'https://7229-47-154-125-116.ngrok-free.app';
let device;
let callStatusElement;
let TWILIO_PHONE_NUMBER;

async function initializeApp() {
  try {
    const response = await axios.get('/config');
    TWILIO_PHONE_NUMBER = response.data.TWILIO_PHONE_NUMBER;
    // Continue with the rest of your app initialization
    loadConversations();
  } catch (error) {
    console.error('Error fetching configuration:', error);
  }
}

// Call this function when your app starts
document.addEventListener('DOMContentLoaded', initializeApp);

// WebSocket connection setup
function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = function(event) {
        console.log('WebSocket connection established');
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);
      
        if (data.type === 'newMessage') {
          handleNewMessage(data);
        }
      
        // Handle new conversation event
        if (data.type === 'newConversation') {
          handleNewConversation(data);
        }
      };

    socket.onclose = function(event) {
        console.log('WebSocket connection closed');
        setTimeout(setupWebSocket, 5000); // Attempt to reconnect after 5 seconds
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function handleNewConversation(data) {
    const conversationsDiv = document.getElementById('conversations');
  
    const newConversationHtml = `
      <div class="conversation" id="conv-${data.conversationSid}" onclick="selectConversation('${data.conversationSid}', '${data.friendlyName}')">
        <div class="conversation-header">
          <strong>${data.friendlyName}</strong>
          <span class="time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div class="delete-btn-container">
            <button class="delete-btn" data-sid="${data.conversationSid}" aria-label="Delete Conversation">🗑️</button>
          </div>
        </div>
        <div class="conversation-content">
          <div class="last-message">${data.lastMessage}</div>
        </div>
      </div>
    `;
  
    conversationsDiv.insertAdjacentHTML('afterbegin', newConversationHtml);
  
    // Re-attach event listeners for the delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const sid = event.target.getAttribute('data-sid');
        deleteConversation(sid);
      });
    });
  }

function handleNewMessage(data) {
// Update the conversation preview in the left pane
updateConversationPreview(data.conversationSid, {
body: data.body,
author: data.author,
dateCreated: new Date().toISOString()
});

// If the current conversation is open, append the message
if (currentConversationSid === data.conversationSid) {
appendMessage(data);
}

// Move the updated conversation to the top of the list
moveConversationToTop(data.conversationSid);
}

function scrollToBottom(elementId) {
const element = document.getElementById(elementId);
if (element) {
element.scrollTop = element.scrollHeight;
}
}

function appendMessage(message) {
const messagesDiv = document.getElementById('messages');
const messageClass = (message.author === TWILIO_PHONE_NUMBER) ? 'right' : 'left';
const messageHtml = `
<div class="message ${messageClass}">
  <span>${message.body}</span>
  <time>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
</div>
`;
messagesDiv.insertAdjacentHTML('beforeend', messageHtml);

if (autoScrollEnabled) {
messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
}

function updateConversationPreviewInList(conversationSid, lastMessageBody) {
    const conversationDiv = document.getElementById(`conv-${conversationSid}`);
    if (conversationDiv) {
        const lastMessageDiv = conversationDiv.querySelector('.last-message');
        if (lastMessageDiv) {
            lastMessageDiv.textContent = lastMessageBody;
        }
    }
}

function moveConversationToTop(conversationSid) {
    const conversationsDiv = document.getElementById('conversations');
    const conversationDiv = document.getElementById(`conv-${conversationSid}`);
    if (conversationDiv && conversationsDiv.firstChild !== conversationDiv) {
        conversationsDiv.insertBefore(conversationDiv, conversationsDiv.firstChild);
    }
}

document.getElementById('new-conversation-btn').addEventListener('click', function() {
  document.getElementById('new-conversation-modal').style.display = 'flex';
});

document.getElementById('theme-toggle-btn').addEventListener('click', function() {
  toggleTheme();
  const currentIcon = document.body.getAttribute('data-theme') === 'dark' ? '🌞' : '🌜';
  this.textContent = currentIcon;
});

function closeModal() {
  document.getElementById('new-conversation-modal').style.display = 'none';
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', currentTheme);
}

function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv.scrollTop + messagesDiv.clientHeight < messagesDiv.scrollHeight) {
    autoScrollEnabled = false;
  } else {
    autoScrollEnabled = true;
  }
}

async function loadConversations() {
document.getElementById('loading-spinner').style.display = 'block';

try {
const response = await axios.get('/conversations');
let conversations = response.data;

conversations = await Promise.all(conversations.map(async conversation => {
  const messagesResponse = await axios.get(`/conversations/${conversation.sid}/messages`);
  const messages = messagesResponse.data;
  const lastMessage = messages[messages.length - 1];
  const lastMessageTime = lastMessage ? new Date(lastMessage.dateCreated).getTime() : 0;
  conversation.lastMessageTime = lastMessageTime;
  conversation.lastMessage = lastMessage ? lastMessage.body : '';
  conversation.lastMessageAuthor = lastMessage ? lastMessage.author : '';

  return conversation;
}));

conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

const conversationList = conversations.map(conversation => {
  const lastMessageTime = new Date(conversation.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let displayName = conversation.friendlyName || conversation.sid;
  if (displayName.startsWith("Conversation with ")) {
    displayName = displayName.replace("Conversation with ", "");
  }

  const lastMessageText = conversation.lastMessage ? conversation.lastMessage : 'No messages yet';

  return `
    <div class="conversation" id="conv-${conversation.sid}" onclick="selectConversation('${conversation.sid}', '${displayName}')">
      <div class="conversation-header">
        <strong>${displayName}</strong>
        <span class="time">${lastMessageTime}</span>
        <div class="delete-btn-container">
          <button class="delete-btn" data-sid="${conversation.sid}" aria-label="Delete Conversation">🗑️</button>
        </div>
      </div>
      <div class="conversation-content">
        <div class="last-message">${lastMessageText}</div>
      </div>
    </div>
  `;
}).join('');

document.getElementById('conversations').innerHTML = conversationList;

document.querySelectorAll('.delete-btn').forEach(button => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const sid = event.target.getAttribute('data-sid');
    deleteConversation(sid);
  });
});

if (currentConversationSid) {
  document.getElementById(`conv-${currentConversationSid}`).classList.add('selected');
}

conversationsLoaded = true;
} catch (error) {
console.error('Error loading conversations:', error);
} finally {
document.getElementById('loading-spinner').style.display = 'none';
}
}

// Add this event listener to load conversations when the page loads
document.addEventListener('DOMContentLoaded', () => {
loadConversations();
setupWebSocket();
});

// calling

async function setupDevice() {
    try {
      console.log('Fetching token from server...');
      const response = await axios.get(`${NGROK_URL}/token`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
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
        enableRingingState: true
      });
  
      device.on('ready', function(device) {
        console.log('Twilio.Device Ready!');
      });
  
      device.on('error', function(error) {
        console.error('Twilio.Device Error:', error);
      });
  
      device.on('connect', function(conn) {
        console.log('Successfully established call!');
        updateCallStatus('In call');
      });
  
      device.on('disconnect', function(conn) {
        console.log('Call ended.');
        updateCallStatus('Call ended');
      });
  
      console.log('Twilio.Device setup complete');
    } catch (error) {
      console.error('Error setting up Twilio device:', error);
      if (error.response) {
        console.error('Server response status:', error.response.status);
        console.error('Server response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }
  
  function updateCallStatus(status) {
    if (callStatusElement) {
      callStatusElement.textContent = status;
    } else {
      console.warn('Call status element not found');
    }
  }
  
  async function makeCall() {
    if (!currentConversationSid) {
      alert('Please select a conversation before making a call.');
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
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const params = response.data;
      console.log('Call parameters:', params);
  
      // Make sure the To parameter is included in the request to /voice
      await axios.post(`${NGROK_URL}/voice`, { To: params.To })
        .then(response => {
          console.log('Call initiated:', response.data);
        })
        .catch(error => {
          console.error('Error initiating call:', error);
          alert('Failed to initiate call. Please check the console for more details.');
          return;
        });
  
      console.log('Initiating call...');
      const call = await device.connect({ To: params.To, From: params.From });
      updateCallStatus('Calling...');
  
      call.on('accept', () => {
        console.log('Call accepted');
        updateCallStatus('In call');
      });
  
      call.on('disconnect', () => {
        console.log('Call disconnected');
        updateCallStatus('Call ended');
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
  
  // Initialize the device when the page loads
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadConversations();
    setupWebSocket();
    
    callStatusElement = document.getElementById('call-status');
    
    const callButton = document.getElementById('call-btn');
    if (callButton) {
      callButton.addEventListener('click', makeCall);
    } else {
      console.error('Call button not found in the DOM');
    }
  });
  
  function endCall() {
    if (device) {
      device.disconnectAll();
    }
  }
  

  
  // Modify your selectConversation function to show the call button
  async function selectConversation(sid, displayName) {
    if (!conversationsLoaded) {
      alert('Please wait until conversations are fully loaded.');
      return;
    }
  
    currentConversationSid = sid;
  
    document.getElementById('loading-spinner').style.display = 'block';
  
    document.getElementById('messages').style.display = 'none';
    document.getElementById('message-input').style.display = 'none';
  
    try {
      document.querySelectorAll('.conversation').forEach(conv => {
        conv.classList.remove('selected');
      });
      document.getElementById(`conv-${sid}`).classList.add('selected');
  
      document.getElementById('messages-title').style.display = 'flex';
      document.getElementById('no-conversation').style.display = 'none';
      document.getElementById('call-btn').style.display = 'block'; // Show call button
  
      await loadMessages(sid, displayName);
  
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
  
      document.getElementById('conversation-title').textContent = displayName;
  
      const messageList = messages.map(message => {
        const author = message.author.trim();
        const displayAuthor = author.startsWith('CH') ? displayName : author;
        const messageClass = (author === TWILIO_PHONE_NUMBER) ? 'right' : 'left';
        return `
          <div class="message ${messageClass}">
            <span>${message.body}</span>
            <time>${new Date(message.dateCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        `;
      }).join('');
  
      document.getElementById('messages').innerHTML = messageList;
  
      document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
  
      const latestMessage = messages[messages.length - 1];
      updateConversationPreview(sid, latestMessage);
  
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.error(`Conversation ${sid} was not found, it may have been deleted.`);
        closeConversation();
      } else {
        console.error(`Error fetching messages for conversation ${sid}:`, error);
      }
    }
  }

  function sendMessage() {
    const inputField = document.getElementById('new-message');
    const message = inputField.value.trim();
  
    if (message === '') {
      return;  // Don't send an empty message
    }
  
    axios.post(`/conversations/${currentConversationSid}/messages`, {
      message: message
    }).then(response => {
      inputField.value = '';  // Clear the input field after sending the message
      console.log('Message sent:', response.data);
    }).catch(error => {
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

  if (confirm("Are you sure you want to delete this conversation?")) {
    if (prompt("Type 'CONFIRM_DELETE' to confirm.") === 'CONFIRM_DELETE') {
      try {
        axios.delete(`/conversations/${sid}`, { data: { confirmToken: 'CONFIRM_DELETE' } }).then(() => {
          console.log(`Conversation ${sid} deleted successfully.`);
          loadConversations();  // Refresh the conversation list after deletion
          if (currentConversationSid === sid) {
            closeConversation();
          }
        });
      } catch (error) {
        alert("Failed to delete conversation. Please try again later.");
        console.error('Error deleting conversation:', error);
      }
    }
  }
}

// Update your closeConversation function to hide the call button
function closeConversation() {
    currentConversationSid = null;
    document.getElementById('conversation-title').textContent = '';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('message-input').style.display = 'none';
    document.getElementById('messages-title').style.display = 'none';
    document.getElementById('messages').style.display = 'none';
    document.getElementById('no-conversation').style.display = 'flex';
    document.getElementById('call-btn').style.display = 'none'; // Hide call button
  
    document.querySelectorAll('.conversation').forEach(conv => {
      conv.classList.remove('selected');
    });
  
    setTimeout(() => {
      loadConversations();
    }, 200);
  }

function updateConversationPreview(conversationSid, latestMessage) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);

  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    if (lastMessageDiv && latestMessage) {
      lastMessageDiv.textContent = latestMessage.body;
    }
  }
}

async function startConversation(event) {
  event.preventDefault();
  const form = event.target;
  const phoneNumber = form.phoneNumber.value.trim();
  const message = form.message.value.trim();

  if (phoneNumber && message) {
    try {
      const response = await axios.post('/start-conversation', { phoneNumber, message });

      if (response.data.existing) {
        const userConfirmed = confirm('This conversation already exists. Would you like to open it?');
        if (userConfirmed) {
          closeModal();  // Close modal after selecting existing conversation
          selectConversation(response.data.sid, phoneNumber);
        }
      } else {
        form.reset();
        await loadConversations();
        closeModal();
        selectConversation(response.data.sid, phoneNumber);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start a new conversation. Please try again.');
    }
  } else {
    alert('Please enter both a phone number and a message.');
  }
}