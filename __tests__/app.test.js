// __tests__/app.test.js

const request = require('supertest');
const app = require('../app'); // Adjust the path if necessary

// Mock the Twilio client
jest.mock('../twilioClient'); // Adjust the path if necessary

const HTTP_OK = 200;

describe('GET /config', () => {
  it('should return configuration details', async () => {
    const response = await request(app).get('/config');
    expect(response.statusCode).toBe(HTTP_OK);
    expect(response.body).toHaveProperty('TWILIO_PHONE_NUMBER');
    expect(response.body).toHaveProperty('NGROK_URL');
  });
});

// Additional tests can be added here

// Example of closing resources after all tests (if any)
// afterAll(() => {
//   // If you have any servers or connections to close, do it here
// });