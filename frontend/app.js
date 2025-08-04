// public/app.js

const socket = io("https://aap-jaisa-koi-production.up.railway.app"); // auto-connect to backend

// DOM Elements
const startBtn = document.getElementById("startChat");
const nextBtn = document.getElementById("nextBtn");
const leaveBtn = document.getElementById("leaveBtn");
const callScreen = document.getElementById("callScreen");
const statusEl = document.getElementById("status");
const remoteAudio = document.getElementById("remoteAudio");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");

let peerConnection;
let localStream;
let currentPartnerId = null;

// ICE servers (STUN only for now)
const iceConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Join queue
startBtn.addEventListener("click", () => {
  socket.emit("join");
  statusEl.classList.remove("hidden");
  startBtn.classList.add("hidden");
});

// Create WebRTC connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceConfig);

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("signal", {
        targetId: currentPartnerId,
        data: { candidate: e.candidate },
      });
    }
  };

  peerConnection.ontrack = (e) => {
    remoteAudio.srcObject = e.streams[0];
  };
}

// Socket handlers
socket.on("waiting", () => {
  statusEl.textContent = "🔎 Looking for a match...";
});

socket.on("matched", async ({ partnerId }) => {
  currentPartnerId = partnerId;
  statusEl.classList.add("hidden");
  callScreen.classList.remove("hidden");

  createPeerConnection();

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  // Caller initiates offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("signal", {
    targetId: currentPartnerId,
    data: { sdp: offer },
  });
});

socket.on("signal", async ({ from, data }) => {
  currentPartnerId = from;
  if (!peerConnection) {
    createPeerConnection();
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));
  }

  if (data.sdp) {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.sdp)
    );
    if (data.sdp.type === "offer") {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", {
        targetId: currentPartnerId,
        data: { sdp: answer },
      });
    }
  } else if (data.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error("Failed to add ICE candidate", err);
    }
  }
});

// Ephemeral chat
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chatInput.value.trim()) {
    const message = chatInput.value.trim();
    socket.emit("chat", { message });
    appendMessage(message, "me");
    chatInput.value = "";
  }
});

socket.on("chat", ({ message }) => {
  appendMessage(message, "them");
});

function appendMessage(msg, type) {
  const el = document.createElement("div");
  el.className = `chat-message ${type}`;
  el.textContent = msg;
  el.classList.add("flex", "text-white", "mb-1");
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// "Next" button
nextBtn.addEventListener("click", () => {
  cleanupCall();
  socket.emit("next");
  statusEl.classList.remove("hidden");
  callScreen.classList.add("hidden");
});

// "Leave" button
leaveBtn.addEventListener("click", () => {
  cleanupCall();
  socket.disconnect();
  location.reload();
});

// 🆕 Listen for online user count updates
socket.on("userCount", (count) => {
  console.log("👥 Online users:", count);
  const el = document.getElementById("onlineCount");
  if (el) {
    el.textContent = `${count} online`;
  }
});

// Handle when partner disconnects or skips
socket.on("partner-left", () => {
  alert("Your partner left the chat.");
  cleanupCall();
  callScreen.classList.add("hidden");
  startBtn.classList.remove("hidden");
});

function cleanupCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  currentPartnerId = null;
  chatBox.innerHTML = "";
}
