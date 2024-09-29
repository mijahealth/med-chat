// public/js/api.js

/**
 * The Messenger for Our Chat Playground
 * 
 * Imagine this file is like a friendly postal worker for our chat playground.
 * It helps send and receive messages between you, your friends, and the chat server.
 * This postal worker knows how to get information about conversations, send new messages,
 * delete old conversations, and even set up special video chat rooms. It's always there
 * to make sure your messages are delivered correctly and to help you manage your conversations!
 */

import axios from 'axios';

/**
 * API object containing methods for interacting with the server.
 * @type {Object}
 */
export const api = {
  /**
   * Fetches the configuration from the server.
   * @returns {Promise<Object>} The configuration data.
   */
  getConfig: () => axios.get('/config').then((res) => res.data),

  /**
   * Retrieves all conversations from the server.
   * @returns {Promise<Array>} An array of conversation objects.
   */
  getConversations: () => axios.get('/conversations').then((res) => res.data),

  /**
   * Fetches details of a specific conversation.
   * @param {string} sid - The conversation ID.
   * @returns {Promise<Object>} The conversation details.
   */
  getConversationDetails: (sid) =>
    axios.get(`/conversations/${sid}`).then((res) => res.data),

  /**
   * Retrieves messages for a specific conversation.
   * @param {string} sid - The conversation ID.
   * @param {Object} [params={}] - Additional parameters for the request.
   * @returns {Promise<Array>} An array of message objects.
   */
  getMessages: (sid, params = {}) =>
    axios
      .get(`/conversations/${sid}/messages`, { params })
      .then((res) => res.data),

  /**
   * Sends a new message to a specific conversation.
   * @param {string} sid - The conversation ID.
   * @param {string} message - The message content.
   * @returns {Promise<Object>} The sent message object.
   */
  sendMessage: (sid, message) =>
    axios
      .post(`/conversations/${sid}/messages`, { message })
      .then((res) => res.data),

  /**
   * Deletes a specific conversation.
   * @param {string} sid - The conversation ID.
   * @returns {Promise<Object>} The response data from the server.
   */
  deleteConversation: (sid) =>
    axios
      .delete(`/conversations/${sid}`, {
        data: { confirmToken: 'CONFIRM_DELETE' },
      })
      .then((res) => res.data),

  /**
   * Marks all messages in a conversation as read.
   * @param {string} sid - The conversation ID.
   * @returns {Promise<Object>} The response data from the server.
   */
  markMessagesAsRead: (sid) =>
    axios.post(`/conversations/${sid}/mark-read`).then((res) => res.data),

  /**
   * Starts a new conversation.
   * @param {Object} data - The data required to start a new conversation.
   * @returns {Promise<Object>} The new conversation object.
   */
  startConversation: (data) =>
    axios.post('/start-conversation', data).then((res) => res.data),

  /**
   * Searches for conversations based on a query.
   * @param {string} query - The search query.
   * @returns {Promise<Array>} An array of matching conversation objects.
   */
  searchConversations: (query) =>
    axios.get('/search', { params: { query } }).then((res) => res.data),

  /**
   * Retrieves call parameters for a specific conversation.
   * @param {string} sid - The conversation ID.
   * @returns {Promise<Object>} The call parameters.
   */
  getCallParams: (sid) =>
    axios.get(`/call-params/${sid}`).then((res) => res.data),

  /**
   * Creates a new video chat room.
   * @param {Object} data - The data required to create a new video room.
   * @returns {Promise<Object>} The new video room object.
   */
  createVideoRoom: (data) =>
    axios.post('/create-room', data).then((res) => res.data),
};