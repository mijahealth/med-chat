// __tests__/broadcast.test.js

const broadcastModule = require('../modules/broadcast');

describe('Broadcast Module', () => {
  it('should set and get the broadcast function', () => {
    const mockBroadcast = jest.fn();
    broadcastModule.setBroadcast(mockBroadcast);
    const retrievedBroadcast = broadcastModule.getBroadcast();
    expect(retrievedBroadcast).toBe(mockBroadcast);
  });
});