<h1 align="center">
  <br>
  🌌 Cosmos Tutedusko
  <br>
</h1>

<h4 align="center">A high-impact, multiplayer immersive virtual campus and dashboard workspace.</h4>

<p align="center">
  <a href="#-technology-stack">Tech Stack</a> •
  <a href="#-core-features">Features</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-ui-philosophy">UI Philosophy</a> •
  <a href="./SYSTEM_DESIGN.md">System Design</a>
</p>

![Cosmos Campus Banner](https://images.unsplash.com/photo-1614064641936-7324fa3f619b?auto=format&fit=crop&w=1200&q=80) *(Illustrative visualization of spatial interaction)*

---

**Cosmos Tutedusko** is a multi-player interactive virtual campus featuring a 2D spatial map layout, proximity voice and video chat, real-time messaging channels, and a full productivity dashboard interface wrapped in a premium glassmorphic UI.

## 🛠️ Technology Stack

| Frontend        | Backend           | Tools & Services |
|-----------------|-------------------|----------------|
| **React 19**    | **Node.js**       | **Vite**       |
| **PIXI.js**     | **Express**       | **Socket.IO**  |
| **Vanilla CSS** | **MongoDB**       | **PeerJS**     |

## ✨ Core Features

* 🗺️ **Spatial 2D Virtual Map:** Navigate around realistic workplace zones (e.g., MERN Lounge, UI/UX Desk, Dev Club) designed natively using `PIXI.js`.
* 🗣 **WebRTC Spatial Media:** Dynamic Peer-to-Peer Microphone and Camera sharing seamlessly handled via `PeerJS`. Walk near other avatars to trigger spatial proximity features.
* 💬 **Interactive Channels:** A robust persistent dashboard chat offering global threads (`#doubts-discussions`, `#general-chat`) independent of the spatial proximity matrix.
* 🖼️ **Picture-in-Picture Active Calls:** Real-time call windows operate asynchronously as floating modals allowing fluid multitasking across calendar scheduling and team directories.
* 🌓 **Premium Aesthetics:** Combines heavy dark-themed side-dashboards paired with rich immersive environment textures and soft backdrops.

## 🚀 Getting Started

Ensure you have **[Node.js](https://nodejs.org/)** installed along with an active **MongoDB** instance.

### 1. Backend Server Initialization

```bash
# Navigate to the server directory
cd server

# Install dependencies
npm install

# Build environment config
# Create a .env file and add your MONGO_URI, and PORT=3001

# Start the server
npm start
```
*The server launches securely at `http://localhost:3001`.*

### 2. Frontend Client Setup

```bash
# Open a new terminal / split screen & navigate to client
cd client

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*The React App resolves automatically at `http://localhost:5173`.*

## 🖌️ UI Philosophy
Focused on providing a high-impact responsive interface, Cosmos blends a highly productive professional dashboard with an entertaining game-like web canvas.

---

> Built with ❤️ by Tapesh.
