// public/js/api.js
import axios from 'axios';
import { state } from './state.js';

export const api = {
  getConfig: () => axios.get('/config').then(res => res.data),
  getConversations: () => axios.get('/conversations').then(res => res.data),
  getConversationDetails: (sid) => axios.get(`/conversations/${sid}`).then(res => res.data),
  getMessages: (sid, params = {}) => axios.get(`/conversations/${sid}/messages`, { params }).then(res => res.data),
  sendMessage: (sid, message) =>
    axios.post(`/conversations/${sid}/messages`, { message }).then(res => res.data),
  deleteConversation: (sid) =>
    axios.delete(`/conversations/${sid}`, { data: { confirmToken: 'CONFIRM_DELETE' } }).then(res => res.data),
  markMessagesAsRead: (sid) =>
    axios.post(`/conversations/${sid}/mark-read`).then(res => res.data),
  startConversation: (data) =>
    axios.post('/start-conversation', data).then(res => res.data),
  searchConversations: (query) =>
    axios.get('/search', { params: { query } }).then(res => res.data),
  getCallParams: (sid) =>
    axios.get(`/call-params/${sid}`).then(res => res.data),
  createVideoRoom: (data) =>
    axios.post('/create-room', data).then(res => res.data),
};