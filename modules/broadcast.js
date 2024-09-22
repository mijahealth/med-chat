// modules/broadcast.js
let broadcastFunction = null;

/**
 * Sets the broadcast function
 * @param {Function} func 
 */
function setBroadcast(func) {
  broadcastFunction = func;
}

/**
 * Retrieves the broadcast function
 * @returns {Function} 
 */
function getBroadcast() {
  return broadcastFunction;
}

module.exports = {
  setBroadcast,
  getBroadcast,
};