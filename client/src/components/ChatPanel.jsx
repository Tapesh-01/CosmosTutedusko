import React, { useState, useRef, useEffect } from 'react';

const ChatPanel = ({ messages, proximityUsers, sendMessage, onClose }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const isConnected = proximityUsers.length > 0;

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-icon">💬</div>
          <div>
            <div className="chat-title">Nearby Chat</div>
            {isConnected ? (
              <div className="chat-subtitle connected">
                <span className="dot-green" /> {proximityUsers.length} user{proximityUsers.length > 1 ? 's' : ''} nearby
              </div>
            ) : (
              <div className="chat-subtitle">Move close to someone</div>
            )}
          </div>
        </div>
        {onClose && (
          <button className="chat-close" onClick={onClose}>✕</button>
        )}
      </div>

      {/* Nearby Users Pills */}
      {isConnected && (
        <div className="nearby-pills">
          {proximityUsers.map((u, i) => (
            <div key={i} className="user-pill">
              <span className="pill-dot" />
              {u.name}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌌</div>
            <p>No messages yet.</p>
            <p className="empty-hint">Walk up to someone to start chatting!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className="message-bubble">
              <div className="msg-sender">{msg.sender}</div>
              <div className="msg-text">{msg.text}</div>
              <div className="msg-time">{msg.timestamp}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          className={`chat-input ${!isConnected ? 'disabled' : ''}`}
          type="text"
          placeholder={isConnected ? 'Type a message...' : 'Move closer to chat...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!isConnected}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.stopPropagation(); handleSend(); }
          }}
        />
        <button
          className={`send-btn ${!isConnected ? 'disabled' : ''}`}
          onClick={handleSend}
          disabled={!isConnected}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
