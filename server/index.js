const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { User, Message } = require('./models');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5180", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// ─── MongoDB Connection ────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected:', process.env.MONGO_URI))
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// ─── In-Memory Active Users (for real-time speed) ─────────────
// MongoDB is used for persistence; memory is used for broadcasting
const activeUsers = {};
const PROXIMITY_RADIUS = 150;

// ─── REST API Endpoints ────────────────────────────────────────

// Get all chat history
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 }).limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session stats (for admin/debug)
app.get('/api/stats', async (req, res) => {
  try {
    const totalUsers   = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    const onlineUsers  = Object.keys(activeUsers).length;
    res.json({ totalUsers, totalMessages, onlineUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Socket.IO Logic ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 User Connected:', socket.id);

  // ── 1. User Joins the Space ──────────────────────────────────
  socket.on('join-space', async (userData) => {
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const userEntry = {
      id:    socket.id,
      name:  userData.name || 'Anonymous',
      x:     userData.x || 500,
      y:     userData.y || 400,
      color,
    };

    // Save to in-memory store (fast, for real-time)
    activeUsers[socket.id] = userEntry;

    // Persist to MongoDB (async, non-blocking)
    User.findOneAndUpdate(
      { socketId: socket.id },
      { socketId: socket.id, name: userEntry.name, color, x: userEntry.x, y: userEntry.y, isOnline: true, joinedAt: new Date() },
      { upsert: true, new: true }
    ).catch(err => console.error('DB Error (join):', err.message));

    // Send all current users to the new user
    socket.emit('current-users', activeUsers);

    // Broadcast the new user to everyone else
    socket.broadcast.emit('user-joined', userEntry);

    console.log(`👤 ${userEntry.name} joined (${socket.id})`);
  });

  // ── 2. User Moves ────────────────────────────────────────────
  socket.on('move', (position) => {
    if (!activeUsers[socket.id]) return;
    activeUsers[socket.id].x = position.x;
    activeUsers[socket.id].y = position.y;

    // Broadcast position to everyone else
    socket.broadcast.emit('user-moved', activeUsers[socket.id]);

    // Update position in DB (throttled in production)
    User.findOneAndUpdate(
      { socketId: socket.id },
      { x: position.x, y: position.y, lastSeen: new Date() }
    ).catch(() => {}); // silently ignore
  });

  // ── 3. Chat Message ──────────────────────────────────────────
  socket.on('send-chat', async (messageText) => {
    const sender = activeUsers[socket.id];
    if (!sender || !messageText?.trim()) return;

    const chatData = {
      id:        Date.now(),
      sender:    sender.name,
      senderId:  socket.id,
      text:      messageText.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    // Save to MongoDB
    try {
      await new Message({
        senderId:   socket.id,
        senderName: sender.name,
        text:       messageText.trim(),
        posX:       sender.x,
        posY:       sender.y,
      }).save();
    } catch (err) {
      console.error('DB Error (message):', err.message);
    }

    // Proximity broadcasting: only send to users within radius
    Object.keys(activeUsers).forEach(id => {
      const target = activeUsers[id];
      const dist = Math.sqrt(
        Math.pow(sender.x - target.x, 2) +
        Math.pow(sender.y - target.y, 2)
      );
      if (dist < PROXIMITY_RADIUS) {
        io.to(id).emit('receive-chat', chatData);
      }
    });
  });

  // ── 3b. Global Chat Message (Channels) ───────────────────────
  socket.on('send-global-chat', async (messageData) => {
    const sender = activeUsers[socket.id];
    if (!sender || !messageData?.text?.trim()) return;

    const chatData = {
      id:        Date.now(),
      sender:    sender.name,
      senderId:  socket.id,
      text:      messageData.text.trim(),
      channel:   messageData.channel || 'general',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Broadcast to everyone
    io.emit('receive-global-chat', chatData);
  });


  // ── 4. Toggle Hand ──────────────────────────────────────────
  socket.on('toggle-hand', (isHandRaised) => {
    if (!activeUsers[socket.id]) return;
    activeUsers[socket.id].isHandRaised = isHandRaised;
    console.log(`✋ ${activeUsers[socket.id].name} hand: ${isHandRaised}`);
    io.emit('user-hand-raised', { id: socket.id, isHandRaised });
  });

  // ── 5. Disconnect ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = activeUsers[socket.id];
    console.log(`👋 ${user?.name || 'User'} disconnected (${socket.id})`);

    // Remove from memory
    delete activeUsers[socket.id];

    // Mark offline in DB
    User.findOneAndUpdate(
      { socketId: socket.id },
      { isOnline: false, lastSeen: new Date() }
    ).catch(() => {});

    // Notify everyone
    io.emit('user-left', socket.id);
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Cosmos Server running on port ${PORT}`);
});
