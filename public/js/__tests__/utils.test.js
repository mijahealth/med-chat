// public/js/__tests__/utils.test.js

/**
 * @jest-environment jsdom
 */

import { 
    log,
    formatTime,
    scrollToBottom,
    checkScrollPosition,
    playNotificationSound,
    debounce,
    isValidDate,
    setUserInteracted,
    isValidPhoneNumber,
    isValidName,
    isValidEmail,
    isValidState,
    isValidMessage,
  } from '../utils.js';
  
  import { state } from '../state.js';
  
  jest.mock('../state.js');
  
  describe('utils.js', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      document.body.innerHTML = ''; // Clear DOM
      jest.useRealTimers(); // Reset any fake timers
    });
  
    // Test for the log function
    describe('log', () => {
      it('should call console.log with correct message and data', () => {
        console.log = jest.fn();
        const message = 'Test message';
        const data = { key: 'value' };
        log(message, data);
        expect(console.log).toHaveBeenCalledWith(`[LOG] ${message}`, data);
      });
  
      it('should call console.log with empty data if not provided', () => {
        console.log = jest.fn();
        const message = 'Test message';
        log(message);
        expect(console.log).toHaveBeenCalledWith(`[LOG] ${message}`, {});
      });
    });
  
    // Test for the formatTime function
    describe('formatTime', () => {
      it('should format a valid date string correctly', () => {
        const dateString = '2023-10-06T14:48:00.000Z';
        const formattedTime = formatTime(dateString);
        const expectedTime = new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        expect(formattedTime).toBe(expectedTime);
      });
    });
  
    // Test for the scrollToBottom function
    describe('scrollToBottom', () => {
      it('should set scrollTop to scrollHeight for the given element', () => {
        const elementId = 'test-element';
        const element = document.createElement('div');
        element.id = elementId;
  
        // Mock scrollHeight using defineProperty
        Object.defineProperty(element, 'scrollHeight', {
          value: 1000,
          writable: true,
        });
  
        // Mock scrollTop
        element.scrollTop = 0;
  
        document.body.appendChild(element);
  
        scrollToBottom(elementId);
  
        expect(element.scrollTop).toBe(element.scrollHeight);
      });
  
      it('should do nothing if the element does not exist', () => {
        const elementId = 'non-existent';
        // No element with id 'non-existent'
        expect(() => scrollToBottom(elementId)).not.toThrow();
      });
    });
  
    // Test for the checkScrollPosition function
    describe('checkScrollPosition', () => {
      it('should set autoScrollEnabled to true if scrolled to bottom within 10px', () => {
        const messagesDiv = document.createElement('div');
        messagesDiv.id = 'messages';
  
        // Mock scrollTop, clientHeight, and scrollHeight
        Object.defineProperty(messagesDiv, 'scrollTop', {
          value: 990,
          writable: true,
        });
  
        Object.defineProperty(messagesDiv, 'clientHeight', {
          value: 10,
          writable: true,
        });
  
        Object.defineProperty(messagesDiv, 'scrollHeight', {
          value: 1000,
          writable: true,
        });
  
        document.body.appendChild(messagesDiv);
  
        checkScrollPosition();
  
        expect(state.autoScrollEnabled).toBe(true);
      });
  
      it('should set autoScrollEnabled to false if not scrolled to bottom within 10px', () => {
        const messagesDiv = document.createElement('div');
        messagesDiv.id = 'messages';
  
        // Mock scrollTop, clientHeight, and scrollHeight
        Object.defineProperty(messagesDiv, 'scrollTop', {
          value: 500,
          writable: true,
        });
  
        Object.defineProperty(messagesDiv, 'clientHeight', {
          value: 10,
          writable: true,
        });
  
        Object.defineProperty(messagesDiv, 'scrollHeight', {
          value: 1000,
          writable: true,
        });
  
        document.body.appendChild(messagesDiv);
  
        checkScrollPosition();
  
        expect(state.autoScrollEnabled).toBe(false);
      });
    });
  
    // Test for the playNotificationSound function
    describe('playNotificationSound', () => {
      let originalAudio;
  
      beforeAll(() => {
        originalAudio = global.Audio;
      });
  
      afterAll(() => {
        global.Audio = originalAudio;
      });
  
      it('should play notification sound if userInteracted is true', async () => {
        state.userInteracted = true;
        const mockPlay = jest.fn().mockResolvedValue();
        const mockAudio = {
          play: mockPlay,
        };
        global.Audio = jest.fn(() => mockAudio);
  
        console.log = jest.fn();
  
        playNotificationSound();
  
        // Wait for the Promise in play() to resolve
        await Promise.resolve();
  
        expect(global.Audio).toHaveBeenCalledWith('/sounds/notification.mp3');
        expect(mockPlay).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('Notification sound played successfully');
      });

      it("should log that sound is not played if user hasn't interacted", () => {
        state.userInteracted = false;
        console.log = jest.fn();
  
        playNotificationSound();
  
        expect(console.log).toHaveBeenCalledWith("[LOG] User hasn't interacted with the page yet. Sound not played.", {});
        expect(global.Audio).not.toHaveBeenCalled();
      });
    });
  
    // Test for the debounce function
    describe('debounce', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });
  
      afterEach(() => {
        jest.useRealTimers();
      });
  
      it('should debounce the function and call it after the wait time', () => {
        const func = jest.fn();
        const debouncedFunc = debounce(func, 1000);
  
        debouncedFunc();
        debouncedFunc();
        debouncedFunc();
  
        // At this point, func should not have been called yet
        expect(func).not.toHaveBeenCalled();
  
        // Fast-forward time
        jest.advanceTimersByTime(1000);
  
        expect(func).toHaveBeenCalledTimes(1);
      });
  
      it('should pass arguments to the debounced function', () => {
        const func = jest.fn();
        const debouncedFunc = debounce(func, 500);
  
        debouncedFunc('arg1', 'arg2');
  
        // Fast-forward time
        jest.advanceTimersByTime(500);
  
        expect(func).toHaveBeenCalledWith('arg1', 'arg2');
      });
  
      it('should reset the timer if called before wait time', () => {
        const func = jest.fn();
        const debouncedFunc = debounce(func, 1000);
  
        debouncedFunc();
        jest.advanceTimersByTime(500);
        debouncedFunc();
        jest.advanceTimersByTime(500);
        debouncedFunc();
        jest.advanceTimersByTime(1000);
  
        expect(func).toHaveBeenCalledTimes(1);
      });
    });
  
    // Test for the isValidDate function
    describe('isValidDate', () => {
      it('should return true for valid date strings', () => {
        expect(isValidDate('2023-10-06')).toBe(true);
        expect(isValidDate('1990-01-01')).toBe(true);
      });
  
      it('should return false for invalid date strings', () => {
        expect(isValidDate('2023-13-06')).toBe(false); // Invalid month
        expect(isValidDate('2023-10-32')).toBe(false); // Invalid day
        expect(isValidDate('20231006')).toBe(false);   // Missing hyphens
        expect(isValidDate('invalid-date')).toBe(false);
      });
  
      it('should return false for non-string inputs', () => {
        expect(isValidDate(null)).toBe(false);
        expect(isValidDate(undefined)).toBe(false);
        expect(isValidDate(123456)).toBe(false);
      });
    });
  
    // Test for the setUserInteracted function
    describe('setUserInteracted', () => {
      it('should set state.userInteracted to true', () => {
        state.userInteracted = false;
        setUserInteracted();
        expect(state.userInteracted).toBe(true);
      });
    });
  
    // Test for the isValidPhoneNumber function
    describe('isValidPhoneNumber', () => {
      it('should return true for valid phone numbers', () => {
        expect(isValidPhoneNumber('+1234567890')).toBe(true);
        expect(isValidPhoneNumber('+123456789012345')).toBe(true);
      });
  
      it('should return false for invalid phone numbers', () => {
        expect(isValidPhoneNumber('1234567890')).toBe(false); // Missing +
        expect(isValidPhoneNumber('+12345')).toBe(false); // Too short
        expect(isValidPhoneNumber('+1234567890123456')).toBe(false); // Too long
        expect(isValidPhoneNumber('+123456789a')).toBe(false); // Non-digit
      });
    });
  
    // Test for the isValidName function
    describe('isValidName', () => {
      it('should return true for non-empty trimmed names', () => {
        expect(isValidName('Alice')).toBe(true);
        expect(isValidName('  Bob  ')).toBe(true);
      });
  
      it('should return false for empty or whitespace-only names', () => {
        expect(isValidName('')).toBe(false);
        expect(isValidName('   ')).toBe(false);
        expect(isValidName('\n')).toBe(false);
      });
    });
  
    // Test for the isValidEmail function
    describe('isValidEmail', () => {
      it('should return true for valid email addresses', () => {
        expect(isValidEmail('alice@example.com')).toBe(true);
        expect(isValidEmail('bob.smith@domain.co')).toBe(true);
        expect(isValidEmail('user+alias@domain.com')).toBe(true);
      });
    });
  
    // Test for the isValidState function
    describe('isValidState', () => {
      it('should return true for non-empty trimmed states', () => {
        expect(isValidState('California')).toBe(true);
        expect(isValidState(' NY ')).toBe(true);
      });
  
      it('should return false for empty or whitespace-only states', () => {
        expect(isValidState('')).toBe(false);
        expect(isValidState('   ')).toBe(false);
        expect(isValidState('\n')).toBe(false);
      });
    });
  
    // Test for the isValidMessage function
    describe('isValidMessage', () => {
      it('should return true for non-empty trimmed messages', () => {
        expect(isValidMessage('Hello')).toBe(true);
        expect(isValidMessage('  How are you?  ')).toBe(true);
      });
  
      it('should return false for empty or whitespace-only messages', () => {
        expect(isValidMessage('')).toBe(false);
        expect(isValidMessage('   ')).toBe(false);
        expect(isValidMessage('\n')).toBe(false);
      });
    });
  });