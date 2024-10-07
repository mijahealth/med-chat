// public/js/__tests__/state.test.js

// Import the state modules
import { currentConversation, state } from '../state';

describe('state.js', () => {
  describe('currentConversation', () => {
    it('should initialize sid to null', () => {
      expect(currentConversation).toHaveProperty('sid', null);
    });

    it('should allow updating the sid', () => {
      const testSid = 'CA1234567890abcdef';
      currentConversation.sid = testSid;
      expect(currentConversation.sid).toBe(testSid);
    });
  });

  describe('state', () => {
    it('should initialize TWILIO_PHONE_NUMBER to an empty string', () => {
      expect(state).toHaveProperty('TWILIO_PHONE_NUMBER', '');
    });

    it('should initialize NGROK_URL to an empty string', () => {
      expect(state).toHaveProperty('NGROK_URL', '');
    });

    it('should initialize userInteracted to false', () => {
      expect(state).toHaveProperty('userInteracted', false);
    });

    it('should initialize autoScrollEnabled to true', () => {
      expect(state).toHaveProperty('autoScrollEnabled', true);
    });

    it('should initialize conversationsLoaded to false', () => {
      expect(state).toHaveProperty('conversationsLoaded', false);
    });

    it('should initialize currentTheme to "light"', () => {
      expect(state).toHaveProperty('currentTheme', 'light');
    });

    // Optional: Test mutability if your application logic allows state mutations
    it('should allow updating TWILIO_PHONE_NUMBER', () => {
      const testNumber = '+1234567890';
      state.TWILIO_PHONE_NUMBER = testNumber;
      expect(state.TWILIO_PHONE_NUMBER).toBe(testNumber);
    });

    it('should allow updating currentTheme', () => {
      const newTheme = 'dark';
      state.currentTheme = newTheme;
      expect(state.currentTheme).toBe(newTheme);
    });
  });
});