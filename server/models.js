const mongoose = require('mongoose');

// ─── User Schema ──────────────────────────────────────────────
// Stores session info for each connected user
const userSchema = new mongoose.Schema({
  socketId: { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  color:    { type: String, default: '#ec4899' },
  x:        { type: Number, default: 400 },
  y:        { type: Number, default: 300 },
  isOnline: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

// ─── Chat Message Schema ───────────────────────────────────────
// Stores every message sent in proximity chat
const messageSchema = new mongoose.Schema({
  senderId:   { type: String, required: true },   // socketId
  senderName: { type: String, required: true },
  text:       { type: String, required: true },
  timestamp:  { type: Date, default: Date.now },
  // Snapshot of sender position when message was sent
  posX: { type: Number },
  posY: { type: Number },
});

const User    = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { User, Message };
