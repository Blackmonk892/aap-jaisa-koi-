// socketHandlers.js

const {
  addToQueue,
  removeFromQueue,
  getPartnerId,
  removePair,
  getUserId,
  cleanup,
} = require("./matchmaking");

function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    const count = io.engine.clientsCount;
    console.log("📤 Emitting user count:", count);
    io.emit("userCount", count);

    // 1. User joins the matchmaking queue
    socket.on("join", () => {
      const { matched, partnerSocket, userId } = addToQueue(socket);
      socket.userId = userId; // Save for reconnect support

      if (matched) {
        const partnerId = getUserId(partnerSocket);
        socket.emit("matched", { partnerId });
        partnerSocket.emit("matched", { partnerId: userId });
      } else {
        socket.emit("waiting");
      }
    });

    // 2. Reconnect with previous userId
    socket.on("reconnect-user", ({ userId }) => {
      socket.userId = userId;

      const partnerId = getPartnerId(userId);

      if (partnerId) {
        // Resume connection with partner
        socket.emit("reconnected", { partnerId });

        // Notify partner that user reconnected
        for (let [sid, s] of io.of("/").sockets) {
          if (getUserId(s) === partnerId) {
            io.to(sid).emit("partner-reconnected", { partnerId: userId });
            break;
          }
        }
      } else {
        // Re-enter matchmaking
        const { matched, partnerSocket, userId: newId } = addToQueue(socket);
        if (matched) {
          const partnerId = getUserId(partnerSocket);
          socket.emit("matched", { partnerId });
          partnerSocket.emit("matched", { partnerId: newId });
        } else {
          socket.emit("waiting");
        }
      }
    });

    // 3. WebRTC signaling: offer, answer, ice-candidates
    socket.on("signal", ({ targetId, data }) => {
      for (let [sid, s] of io.of("/").sockets) {
        if (getUserId(s) === targetId) {
          io.to(sid).emit("signal", {
            from: getUserId(socket),
            data,
          });
          break;
        }
      }
    });

    // 4. Ephemeral in-call text chat
    socket.on("chat", ({ message }) => {
      const userId = getUserId(socket);
      const partnerId = getPartnerId(userId);

      if (partnerId) {
        for (let [sid, s] of io.of("/").sockets) {
          if (getUserId(s) === partnerId) {
            io.to(sid).emit("chat", { message });
            break;
          }
        }
      }
    });

    // 5. "Next" — leave current match and re-enter queue
    socket.on("next", () => {
      const userId = getUserId(socket);
      const partnerId = getPartnerId(userId);

      if (partnerId) {
        for (let [sid, s] of io.of("/").sockets) {
          if (getUserId(s) === partnerId) {
            io.to(sid).emit("partner-left");
            break;
          }
        }
        removePair(userId);
      }

      const { matched, partnerSocket, userId: newId } = addToQueue(socket);
      if (matched) {
        const partnerId = getUserId(partnerSocket);
        socket.emit("matched", { partnerId });
        partnerSocket.emit("matched", { partnerId: newId });
      } else {
        socket.emit("waiting");
      }
    });

    // 6. Handle disconnects
    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      const userId = getUserId(socket);
      const partnerId = getPartnerId(userId);

      if (partnerId) {
        for (let [sid, s] of io.of("/").sockets) {
          if (getUserId(s) === partnerId) {
            io.to(sid).emit("partner-left");
            break;
          }
        }
      }

      cleanup(socket); // Clean user from queue or pairs
      const count = io.engine.clientsCount;
      console.log("📤 Emitting user count:", count);
      io.emit("userCount", count);
    });
  });
}

module.exports = { setupSocketHandlers };
