// __tests__/modules.broadcast.test.js
const broadcastModule = require('../modules/broadcast');

describe('Broadcast Module', () => {
  afterEach(() => {
    // Reset the broadcast function after each test
    broadcastModule.setBroadcast(null);
  });

  it('should set the broadcast function correctly', () => {
    const mockFunc = jest.fn();
    broadcastModule.setBroadcast(mockFunc);
    expect(broadcastModule.getBroadcast()).toBe(mockFunc);
  });

  it('should retrieve the current broadcast function', () => {
    const mockFunc = () => {};
    broadcastModule.setBroadcast(mockFunc);
    const retrievedFunc = broadcastModule.getBroadcast();
    expect(retrievedFunc).toBe(mockFunc);
  });

  it('should return null if no broadcast function is set', () => {
    expect(broadcastModule.getBroadcast()).toBeNull();
  });
});