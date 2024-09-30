// modules/broadcast.js
let broadcastFunction = null;

/**
 * Sets the broadcast function.
 * @param {Function} func - The function to be used for broadcasting messages.
 */
function setBroadcast(func) {
  broadcastFunction = func;
}

/**
 * Retrieves the current broadcast function.
 * @returns {Function} The function used to broadcast messages.
 */
function getBroadcast() {
  return broadcastFunction;
}

module.exports = {
  setBroadcast,
  getBroadcast,
};