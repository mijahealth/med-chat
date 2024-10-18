// public/js/__tests__/customer.test.js

/**
 * @jest-environment jsdom
 */

import { initializeCustomerPage } from '../customer';

describe('customer.js', () => {
  beforeEach(() => {
    // Set up our document body
    document.body.innerHTML = '<div id="customer-greeting"></div>';
    // Mock window.location
    delete window.location;
    window.location = { pathname: '/customer/1234567890' };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize the customer page with the correct phone number', () => {
    initializeCustomerPage();
    const greetingElement = document.getElementById('customer-greeting');
    expect(greetingElement.textContent).toBe('Hello, customer with phone number: 1234567890');
  });

  it('should handle missing customer greeting element', () => {
    document.body.innerHTML = ''; // Remove the customer-greeting element
    console.error = jest.fn(); // Mock console.error
    initializeCustomerPage();
    expect(console.error).toHaveBeenCalledWith('Customer greeting element not found');
  });

  it('should handle different phone numbers', () => {
    window.location.pathname = '/customer/9876543210';
    initializeCustomerPage();
    const greetingElement = document.getElementById('customer-greeting');
    expect(greetingElement.textContent).toBe('Hello, customer with phone number: 9876543210');
  });
});