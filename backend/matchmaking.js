// matchmaking.js

const { v4: uuidv4 } = require("uuid");

// In-memory queues and state
const waitingQueue = [];
const activePairs = new Map(); // userId => partnerId
const socketIdToUserId = new Map(); // socket.id => userId

function addToQueue(socket) {
  const userId = uuidv4();
  socketIdToUserId.set(socket.id, userId);

  // Check if someone is waiting
  if (waitingQueue.length > 0) {
    const partnerSocket = waitingQueue.shift(); // FIFO
    const partnerId = socketIdToUserId.get(partnerSocket.id);

    // Save pairing
    activePairs.set(userId, partnerId);
    activePairs.set(partnerId, userId);

    return { matched: true, partnerSocket, userId };
  } else {
    // No one to match — add to queue
    waitingQueue.push(socket);
    return { matched: false, userId };
  }
}

function removeFromQueue(socket) {
  const index = waitingQueue.findIndex((s) => s.id === socket.id);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
  socketIdToUserId.delete(socket.id);
}

function getPartnerId(userId) {
  return activePairs.get(userId);
}

function removePair(userId) {
  const partnerId = activePairs.get(userId);
  if (partnerId) {
    activePairs.delete(userId);
    activePairs.delete(partnerId);
  }
}

function getUserId(socket) {
  return socketIdToUserId.get(socket.id);
}

function cleanup(socket) {
  removeFromQueue(socket);
  const userId = socketIdToUserId.get(socket.id);
  if (userId) {
    const partnerId = activePairs.get(userId);
    activePairs.delete(userId);
    activePairs.delete(partnerId);
  }
  socketIdToUserId.delete(socket.id);
}

module.exports = {
  addToQueue,
  removeFromQueue,
  getPartnerId,
  removePair,
  getUserId,
  cleanup,
};
