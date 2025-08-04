// iceConfig.js

const iceServers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302", // Public STUN
    },
    // You can add TURN here later for fallback
  ],
};

module.exports = { iceServers };
