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
        audio.play().then(() => {
            console.log('Notification sound played successfully');
        }).catch((error) => {
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

export function setUserInteracted() {
    state.userInteracted = true;
}

// New validator functions
export function isValidPhoneNumber(phone) {
    return /^\+[0-9]{10,15}$/.test(phone);
}

export function isValidName(name) {
    return name.trim().length > 0;
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidState(state) {
    // This is a simple check. You might want to add a more comprehensive validation,
    // such as checking against a list of valid state abbreviations.
    return state.trim().length > 0;
}

export function isValidMessage(message) {
    return message.trim().length > 0;
}