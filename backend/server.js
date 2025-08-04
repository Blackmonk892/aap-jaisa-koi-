// server.js

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const { setupSocketHandlers } = require("./socketHandlers");

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static(path.join(__dirname, "../frontend")));

// Basic CORS setup (you can customize allowed origins)
app.use(cors());

// Serve basic homepage or health check
app.get("/", (req, res) => {
  res.send("✅ Aap Jaisa Koi signaling server running.");
});

const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for now (customize later in production)
    methods: ["GET", "POST"],
  },
});

// Attach all socket events
setupSocketHandlers(io);

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Signaling server listening on http://0.0.0.0:${PORT}`);
});
