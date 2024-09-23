// public/js/utils.js
import { state } from './state.js';

export function log(message, data = {}) {
    console.log(`[LOG] ${message}`, data);
  }
  
  export function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  export function scrollToBottom(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }
  
  export function checkScrollPosition() {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10) {
      state.autoScrollEnabled = true;
    } else {
      state.autoScrollEnabled = false;
    }
  }
  
  export function playNotificationSound() {
    if (state.userInteracted) {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch((error) => {
        log('Error playing sound', { error });
      });
    } else {
      log('User hasn\'t interacted with the page yet. Sound not played.');
    }
  }
  
  export function debounce(func, wait) {
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
  
  export function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
  
    const date = new Date(dateString);
    const timestamp = date.getTime();
  
    if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
      return false;
    }
  
    return date.toISOString().startsWith(dateString);
  }
  
  export function toggleTheme() {
    state.currentTheme = state.currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', state.currentTheme);
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    themeToggleBtn.innerHTML = `<i data-feather="${state.currentTheme === 'dark' ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
    feather.replace(); // Replace the theme toggle icon
  }