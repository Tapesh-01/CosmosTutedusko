import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export const useSocket = (userName) => {
  const [remoteUsers, setRemoteUsers] = useState({});
  const [messages, setMessages] = useState([]);
  const [globalMessages, setGlobalMessages] = useState([]);
  const [proximityUsers, setProximityUsers] = useState([]);
  const socketRef = useRef(null);
  const myPositionRef = useRef({ x: 400, y: 300 });

  const calculateProximity = (x, y, currentRemoteUsers) => {
    const PROXIMITY_RADIUS = 150;
    const near = [];
    Object.values(currentRemoteUsers).forEach(u => {
      const dist = Math.sqrt(Math.pow(u.x - x, 2) + Math.pow(u.y - y, 2));
      if (dist < PROXIMITY_RADIUS) {
        near.push(u);
      }
    });
    setProximityUsers(near);
  };

  useEffect(() => {
    // 1. Initialize Socket
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    // 2. Join Space
    socket.emit('join-space', { name: userName, x: 400, y: 300, isHandRaised: false });

    // 3. Socket Listeners
    socket.on('current-users', (users) => {
      // Remove self from the remote users list
      const others = { ...users };
      delete others[socket.id];
      setRemoteUsers(others);
    });

    socket.on('user-joined', (user) => {
      setRemoteUsers(prev => ({ ...prev, [user.id]: user }));
    });

    socket.on('user-moved', (user) => {
      setRemoteUsers(prev => {
        const updated = { ...prev, [user.id]: user };
        calculateProximity(myPositionRef.current.x, myPositionRef.current.y, updated);
        return updated;
      });
    });

    socket.on('user-left', (id) => {
      setRemoteUsers(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    });

    socket.on('receive-chat', (msg) => {
      setMessages(prev => [...prev.slice(-49), msg]); // Keep last 50
    });

    socket.on('receive-global-chat', (msg) => {
      setGlobalMessages(prev => [...prev.slice(-99), msg]); // Keep last 100 for dashboard
    });

    socket.on('user-hand-raised', ({ id, isHandRaised }) => {
      setRemoteUsers(prev => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id], isHandRaised } };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [userName]);

  const updatePosition = (x, y) => {
    myPositionRef.current = { x, y };
    if (socketRef.current?.connected) {
      socketRef.current.emit('move', { x, y });
    }
    // We already have the current remoteUsers in state, so we use them here.
    // However, calculateProximity uses the state, which is fine for local updates.
    calculateProximity(x, y, remoteUsers);
  };

  const sendMessage = (text) => {
    socketRef.current?.emit('send-chat', text);
  };

  const sendGlobalMessage = (text, channel) => {
    socketRef.current?.emit('send-global-chat', { text, channel });
  };

  const setHandRaised = (isHandRaised) => {
    socketRef.current?.emit('toggle-hand', isHandRaised);
  };

  return {
    remoteUsers,
    messages,
    globalMessages,
    proximityUsers,
    updatePosition,
    sendMessage,
    sendGlobalMessage,
    setHandRaised,
    socketId: socketRef.current?.id,
  };
};
