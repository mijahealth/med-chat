// public/js/customer.js

/**
 * Initializes the customer page.
 * This function is called when the customer page is loaded.
 * It extracts the phone number from the URL and displays a greeting.
 * 
 * @returns {void}
 */
function initializeCustomerPage() {
    const phoneNumber = window.location.pathname.split('/').pop();
    const customerGreeting = document.getElementById('customer-greeting');
    
    if (customerGreeting) {
      customerGreeting.textContent = `Hello, customer with phone number: ${phoneNumber}`;
    } else {
      console.error('Customer greeting element not found');
    }
  }
  
  // Initialize the page when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', initializeCustomerPage);
  
  // Export the initialization function for potential use in other modules
  export { initializeCustomerPage };