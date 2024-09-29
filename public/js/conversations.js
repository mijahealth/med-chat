// public/js/conversations.js

/**
 * This file is like a big toy box for our chat app. It has all the tools we need
 * to play with conversations - starting them, adding messages, and cleaning up
 * when we're done. Each function in here is like a different toy that helps us
 * talk to our friends through the computer!
 */

import { api } from './api.js';
import { formatTime, log } from './utils.js';
import { currentConversation, state } from './state.js';
import { renderConversations, moveConversationToTop } from './ui.js';

/**
 * Gets all our conversations and puts them in order.
 * 
 * Imagine you have a bunch of letters from your friends. This function
 * takes all those letters, puts the newest ones on top, and shows them
 * to you in a neat stack.
 *
 * @async
 * @returns {Promise<Array>} A promise that resolves to an array of conversations.
 */
export async function loadConversations() {
  document.getElementById('loading-spinner').style.display = 'block';

  try {
    const conversations = await api.getConversations();

    // Sort conversations by newest first
    conversations.sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime),
    );

    renderConversations(conversations);

    if (currentConversation.sid) {
      document
        .getElementById(`conv-${currentConversation.sid}`)
        ?.classList.add('selected');
    }

    state.conversationsLoaded = true;
    return conversations;
  } catch (error) {
    log('Error loading conversations', { error });
    return [];
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
  }
}

/**
 * Updates the preview of the last message in a conversation.
 * 
 * It's like when you get a new text message, and your phone shows you
 * a little peek of what it says. This function does that for our chat app.
 *
 * @async
 * @param {string} conversationSid - The unique identifier for the conversation.
 * @returns {Promise<void>} A promise that resolves when the preview is updated.
 */
export async function updateLatestMessagePreview(conversationSid) {
  try {
    const [latestMessage] = await api.getMessages(conversationSid, {
      limit: 1,
      order: 'desc',
    });
    if (latestMessage) {
      updateConversationPreview(conversationSid, latestMessage);
    }
  } catch (error) {
    const NOT_FOUND_STATUS = 404;
    if (error.response && error.response.status === NOT_FOUND_STATUS) {
      log(
        `Conversation ${conversationSid} not found, it may have been deleted.`,
      );
    } else {
      log('Error fetching latest message', { error });
    }
  }
}

/**
 * Increases the count of unread messages for a conversation.
 * 
 * It's like when you get more and more letters in your mailbox.
 * This function puts a little number on the mailbox to show how
 * many new letters you have.
 *
 * @param {string} conversationSid - The unique identifier for the conversation.
 * @returns {void}
 */
export function incrementUnreadCount(conversationSid) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    conversationDiv.classList.add('unread');
    const unreadBadge = conversationDiv.querySelector('.unread-badge');
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

/**
 * Deals with a brand new conversation.
 * 
 * It's like when you make a new friend. This function helps set up
 * a new chat with them, or if you're already friends, it just updates
 * your last chat.
 *
 * @param {Object} data - The data for the new conversation.
 * @returns {void}
 */
export function handleNewConversation(data) {
  const existingConversation = document.getElementById(
    `conv-${data.conversationSid}`,
  );

  if (existingConversation) {
    log('Conversation already exists, updating', {
      conversationSid: data.conversationSid,
    });
    updateConversationPreview(data.conversationSid, {
      body: data.lastMessage,
      dateCreated: new Date().toISOString(),
    });
    moveConversationToTop(data.conversationSid);
    return;
  }

  renderConversations([data], true);
}

/**
 * Updates an existing conversation with new information.
 * 
 * Imagine you're updating your friend's contact info in your address book.
 * This function does that for our chat list, changing things like the
 * friend's name or the last thing they said.
 *
 * @param {Object} data - The updated data for the conversation.
 * @returns {void}
 */
export function handleUpdateConversation(data) {
  const conversationDiv = document.getElementById(
    `conv-${data.conversationSid}`,
  );
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

    // Move the conversation to the top of the list
    moveConversationToTop(data.conversationSid);
  }
}

/**
 * Removes a conversation from the screen.
 * 
 * It's like when you're done playing with a toy and you put it away.
 * This function takes a conversation off the screen when we don't
 * need it anymore.
 *
 * @param {string} conversationSid - The unique identifier for the conversation to remove.
 * @returns {void}
 */
export function removeConversationFromUI(conversationSid) {
  const conversationElement = document.getElementById(
    `conv-${conversationSid}`,
  );
  if (conversationElement) {
    conversationElement.remove();
    log('Conversation removed from UI', { conversationSid });
  } else {
    log('Conversation element not found for deletion', { conversationSid });
  }

  // If the deleted conversation is currently selected, clear the message pane
  if (currentConversation.sid === conversationSid) {
    currentConversation.sid = null;
    document.getElementById('messages').innerHTML = '';
    document.getElementById('messages-title').innerHTML = '';
    document.getElementById('message-input').style.display = 'none';
    log('Cleared message pane for deleted conversation', { conversationSid });
  }
}

/**
 * Gets all the details about a specific conversation.
 * 
 * It's like looking up a friend in your address book to see all their
 * information. This function does that for our chats.
 *
 * @async
 * @param {string} sid - The unique identifier for the conversation.
 * @returns {Promise<Object>} A promise that resolves to the conversation details.
 * @throws {Error} If there's an error fetching the conversation.
 */
export async function fetchConversation(sid) {
  try {
    return await api.getConversationDetails(sid);
  } catch (error) {
    log('Error fetching conversation', { sid, error });
    throw error;
  }
}

/**
 * Gets a list of all our conversations.
 * 
 * Imagine you're checking all the different chats you have with your friends.
 * This function gives you that list of all your ongoing chats.
 *
 * @async
 * @returns {Promise<Array>} A promise that resolves to an array of conversations.
 * @throws {Error} If there's an error listing the conversations.
 */
export async function listConversations() {
  try {
    return await api.getConversations();
  } catch (error) {
    log('Error listing conversations', { error });
    throw error;
  }
}

/**
 * Starts a brand new conversation.
 * 
 * It's like when you decide to write a letter to a new pen pal.
 * This function helps you start a fresh chat with someone.
 *
 * @async
 * @param {Object} data - The data needed to start a new conversation.
 * @returns {Promise<Object>} A promise that resolves to the new conversation object.
 * @throws {Error} If there's an error creating the conversation.
 */
export async function createConversation(data) {
  try {
    return await api.startConversation(data);
  } catch (error) {
    log('Error creating conversation', { error });
    throw error;
  }
}

/**
 * Removes a conversation completely.
 * 
 * Sometimes you don't need to keep old letters anymore. This function
 * is like throwing away an old letter and removing it from your letter box.
 *
 * @async
 * @param {string} sid - The unique identifier for the conversation to delete.
 * @returns {Promise<void>} A promise that resolves when the conversation is deleted.
 * @throws {Error} If there's an error deleting the conversation.
 */
export async function deleteConversation(sid) {
  try {
    await api.deleteConversation(sid);
    removeConversationFromUI(sid);
    log('Conversation deleted successfully', { sid });
  } catch (error) {
    log('Error deleting conversation', { sid, error });
    throw error;
  }
}

/**
 * Adds a new message to a conversation.
 * 
 * It's like writing a new sentence in your letter to a friend.
 * This function adds what you've just written to your ongoing chat.
 *
 * @async
 * @param {string} conversationSid - The unique identifier for the conversation.
 * @param {string} message - The message to add.
 * @returns {Promise<Object>} A promise that resolves to the new message object.
 * @throws {Error} If there's an error adding the message.
 */
export async function addMessage(conversationSid, message) {
  try {
    return await api.sendMessage(conversationSid, message);
  } catch (error) {
    log('Error adding message', { conversationSid, error });
    throw error;
  }
}

/**
 * Gets all the messages in a conversation.
 * 
 * Imagine reading through all the pages of a letter you've been writing
 * back and forth with a friend. This function shows you all those pages.
 *
 * @async
 * @param {string} conversationSid - The unique identifier for the conversation.
 * @param {Object} [options={}] - Optional parameters for listing messages.
 * @returns {Promise<Array>} A promise that resolves to an array of messages.
 * @throws {Error} If there's an error listing the messages.
 */
export async function listMessages(conversationSid, options = {}) {
  try {
    return await api.getMessages(conversationSid, options);
  } catch (error) {
    log('Error listing messages', { conversationSid, error });
    throw error;
  }
}

/**
 * Marks all messages in a conversation as read.
 * 
 * It's like when you finish reading a letter and put a checkmark on it.
 * This function does that for all the messages in a chat.
 *
 * @async
 * @param {string} conversationSid - The unique identifier for the conversation.
 * @returns {Promise<void>} A promise that resolves when messages are marked as read.
 * @throws {Error} If there's an error marking messages as read.
 */
export async function markMessagesAsRead(conversationSid) {
  try {
    await api.markMessagesAsRead(conversationSid);
  } catch (error) {
    log('Error marking messages as read', { conversationSid, error });
    throw error;
  }
}

/**
 * Updates the preview of a conversation with the latest message.
 * 
 * It's like updating the front of an envelope with a sneak peek of what's inside.
 * This function changes what you see about a chat before you open it.
 *
 * @param {string} conversationSid - The unique identifier for the conversation.
 * @param {Object} latestMessage - The latest message object.
 * @returns {void}
 */
export function updateConversationPreview(conversationSid, latestMessage) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    const timeDiv = conversationDiv.querySelector('.time');
    if (lastMessageDiv) {
      lastMessageDiv.textContent = latestMessage.body;
    }
    if (timeDiv) {
      timeDiv.textContent = formatTime(latestMessage.dateCreated);
    }
  }
}

// This part helps the app update itself without needing to refresh the whole page
if (module.hot) {
  module.hot.dispose(() => {
    log('Cleaning up conversations module');
    // Perform any necessary cleanup
  });
  module.hot.accept(() => {
    log('Conversations module updated');
    // Re-initialize conversations if necessary
    loadConversations().catch((error) => {
      console.error('Error reloading conversations:', error);
    });
  });
}