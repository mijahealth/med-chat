// public/js/__tests__/utils.test.js
import {
    isValidPhoneNumber,
    isValidName,
    isValidEmail,
    isValidDate,
    isValidState,
    isValidMessage,
    debounce,
  } from '../utils';
  
  jest.useFakeTimers();
  
  describe('Utility Functions', () => {
    test('isValidPhoneNumber should validate phone numbers correctly', () => {
      expect(isValidPhoneNumber('+1234567890')).toBe(true);
      expect(isValidPhoneNumber('1234567890')).toBe(false);
      expect(isValidPhoneNumber('+123')).toBe(false);
      expect(isValidPhoneNumber('+123456789012345')).toBe(true);
      expect(isValidPhoneNumber('+1234567890123456')).toBe(false);
    });
  
    test('isValidName should validate names correctly', () => {
      expect(isValidName('John Doe')).toBe(true);
      expect(isValidName('')).toBe(false);
      expect(isValidName('   ')).toBe(false);
    });
  
    test('isValidEmail should validate emails correctly', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
    });
  
    test('isValidDate should validate dates correctly', () => {
      expect(isValidDate('2020-01-01')).toBe(true);
      expect(isValidDate('2020-13-01')).toBe(false);
      expect(isValidDate('invalid-date')).toBe(false);
    });
  
    test('isValidState should validate state correctly', () => {
      expect(isValidState('California')).toBe(true);
      expect(isValidState('')).toBe(false);
      expect(isValidState('   ')).toBe(false);
    });
  
    test('isValidMessage should validate messages correctly', () => {
      expect(isValidMessage('Hello')).toBe(true);
      expect(isValidMessage('')).toBe(false);
      expect(isValidMessage('   ')).toBe(false);
    });
  
    test('debounce should delay function execution', () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 300);
  
      debouncedFunc();
      debouncedFunc();
      debouncedFunc();
  
      expect(func).not.toBeCalled();
  
      jest.advanceTimersByTime(300);
      expect(func).toBeCalledTimes(1);
    });
  });