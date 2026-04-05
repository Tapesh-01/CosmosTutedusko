import React, { useState, useEffect, useRef, useCallback } from 'react';
import CosmosEngine from './components/CosmosEngine';
import { useSocket } from './hooks/useSocket';
import { usePeer } from './hooks/usePeer';
import './App.css';

/* ── helpers ─────────────────────────────────────────── */
const fmtTime = (d) => {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const App = () => {
  const [userName, setUserName]       = useState('');
  const [draft, setDraft]             = useState('');
  const [hasJoined, setHasJoined]     = useState(false);
  const [zoom, setZoom]               = useState(1.0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [showChat, setShowChat]       = useState(false);
  const [chatInput, setChatInput]     = useState('');
  const [showOffline, setShowOffline] = useState(false);
  const [showCallCard, setShowCallCard] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [sidebarTab, setSidebarTab]   = useState(null); // 'activities' | 'conversations'
  const [sidebarPanel, setSidebarPanel] = useState(null); // 'calendar' | 'threads' | 'doubts' | 'general' | 'newcall'
  const [mediaStream, setMediaStream] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [activities, setActivities]   = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [sharingStream, setSharingStream] = useState(null);
  const [dashboardChatInput, setDashboardChatInput] = useState('');

  const videoRef    = useRef(null);
  const loginVideoRef = useRef(null);

  const { messages, globalMessages, proximityUsers, updatePosition, sendMessage, sendGlobalMessage, remoteUsers, setHandRaised, socketId } =
    useSocket(userName);

  const lastProcessedMsgId = useRef(null);
  const processedJoinIds = useRef(new Set());

  /* ── WebRTC combining streams ───────────────────── */
  const [combinedStream, setCombinedStream] = useState(null);
  useEffect(() => {
    const newStream = new MediaStream();
    if (cameraStream) cameraStream.getTracks().forEach(t => newStream.addTrack(t));
    if (mediaStream) mediaStream.getTracks().forEach(t => newStream.addTrack(t));
    setCombinedStream(newStream.getTracks().length > 0 ? newStream : null);
  }, [cameraStream, mediaStream]);

  const { remoteStreams, callUser } = usePeer(socketId, combinedStream);

  // Auto-call other users in the space
  useEffect(() => {
    Object.values(remoteUsers).forEach(u => {
      callUser(u.id, combinedStream);
    });
  }, [remoteUsers, combinedStream, callUser]);

  /* ── Activities feed ─────────────────────────────── */
  useEffect(() => {
    if (!hasJoined) return;
    const base = [
      { id: 1, icon: '🚀', text: `${userName} joined the space`, time: new Date(), type: 'join' },
    ];
    setActivities(base);
  }, [hasJoined, userName]);

  useEffect(() => {
    Object.values(remoteUsers).forEach(u => {
      if (processedJoinIds.current.has(u.id)) return;
      processedJoinIds.current.add(u.id);

      setActivities(prev => [
        { id: `join-${u.id}`, icon: '🟢', text: `${u.name} joined the lobby`, time: new Date(), type: 'join' },
        ...prev,
      ].slice(0, 20));

      if (sidebarTab !== 'activities') {
        setUnreadCount(c => c + 1);
      }
    });
  }, [remoteUsers]); // Removed sidebarTab to prevent redundant processing

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    
    // check if we already processed this specific message ID
    if (last.id === lastProcessedMsgId.current) return;
    lastProcessedMsgId.current = last.id;

    setActivities(prev => [
      { id: `msg-${last.id || Date.now()}`, icon: '💬', text: `${last.sender}: "${last.text}"`, time: new Date(), type: 'message' },
      ...prev,
    ].slice(0, 20));

    if (sidebarTab !== 'activities') {
      setUnreadCount(c => c + 1);
    }
  }, [messages]); // Removed sidebarTab to prevent duplicate adds on tab switch

  /* ── Proximity → auto show chat ─────────────────── */
  useEffect(() => {
    if (proximityUsers.length > 0) {
      setShowChat(true);
    }
  }, [proximityUsers.length]);

  /* ── Auto-open call card when entering proximity ── */
  useEffect(() => {
    if (proximityUsers.length > 0 && !showCallCard) {
      // Just notify, don't force-open — user can click Call btn
      // But if they ARE already in a call session keep it open
    }
    // If no proximity AND no remote users → close call card
    if (proximityUsers.length === 0 && Object.keys(remoteUsers).length === 0) {
      setShowCallCard(false);
    }
  }, [proximityUsers.length, remoteUsers]);

  /* ── Mic via getUserMedia ────────────────────────── */
  const toggleMic = useCallback(async () => {
    if (!isMuted) {
      // Muting: stop stream
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        setMediaStream(null);
      }
      setIsMuted(true);
    } else {
      // Unmuting
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(stream);
        setIsMuted(false);
      } catch {
        setIsMuted(false); // visual only fallback
      }
    }
  }, [isMuted, mediaStream]);

  /* ── Camera via getUserMedia ─────────────────────── */
  const toggleCamera = useCallback(async () => {
    if (!isCameraOff) {
      // Turning OFF camera
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        setCameraStream(null);
      }
      setIsCameraOff(true);
      if (videoRef.current) videoRef.current.srcObject = null;
    } else {
      // Turning ON camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(stream);
        setIsCameraOff(false);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setIsCameraOff(false);
      }
    }
  }, [isCameraOff, cameraStream]);

  /* ── Screen share logic ─────────────────────────── */
  const toggleShareScreen = useCallback(async () => {
    if (isSharingScreen) {
      sharingStream?.getTracks().forEach(t => t.stop());
      setSharingStream(null);
      setIsSharingScreen(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setSharingStream(stream);
        setIsSharingScreen(true);
        stream.getTracks()[0].onended = () => {
          setIsSharingScreen(false);
          setSharingStream(null);
        };
      } catch (err) {
        console.error("Screen share error:", err);
      }
    }
  }, [isSharingScreen, sharingStream]);

  const toggleHand = useCallback(() => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    if (setHandRaised) setHandRaised(newState);
  }, [isHandRaised, setHandRaised]);

  /* ── Login screen camera preview ────────────────── */
  useEffect(() => {
    if (hasJoined) return;
    let localStream;
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then(s => {
        localStream = s;
        if (loginVideoRef.current) {
          loginVideoRef.current.srcObject = s;
          loginVideoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {});
    return () => { localStream?.getTracks().forEach(t => t.stop()); };
  }, [hasJoined]);

  /* ── Search Modal Shortcut ──────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      // Esc
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ── Join ──────────────────────────────────────── */
  const handleJoin = () => {
    if (!draft.trim()) return;
    setUserName(draft.trim());
    setHasJoined(true);
  };

  const handleResetPosition = () => {
    updatePosition(400, 300);
    setShowMoreMenu(false);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleSendDashboardChat = () => {
    if (!dashboardChatInput.trim()) return;
    sendGlobalMessage(dashboardChatInput.trim(), sidebarPanel);
    setDashboardChatInput('');
  };

  const onlineCount = Object.keys(remoteUsers).length + 1;

  /* ════════════════════════════════════════════════════
     LOGIN SCREEN
  ════════════════════════════════════════════════════ */
  if (!hasJoined) {
    return (
      <div className="login-bg">
        <div style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}>
          <div className="login-header">
            <div className="login-header-logo">🌌</div>
            <span>Upskill Mafia MERN</span>
          </div>

          <div className="login-container">
            {/* Left */}
            <div className="login-left">
              <h1 className="login-tagline">
                All space conversations<br />in a <span>single link</span>
              </h1>
              <p className="login-subtitle">
                Click on "Enter Lobby" to join the campus. Happy Learning! 🔥 😺
              </p>
              <label className="login-field-label" htmlFor="cosmos-name-input">Your name</label>
              <input
                id="cosmos-name-input"
                className="login-input"
                placeholder="Enter your name"
                value={draft}
                maxLength={20}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
              <button className="login-btn" onClick={handleJoin}>Enter lobby</button>
              <p className="login-terms">
                By using our platform you confirm that you are over 18, and accept our{' '}
                <a href="#">Terms of Use</a> and <a href="#">Privacy Policy</a>.
              </p>
            </div>

            {/* Right: camera preview */}
            <div className="login-right">
              <div className="camera-preview">
                <video
                  ref={loginVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12, display: 'block' }}
                />
                <div className="camera-preview-overlay">
                  <span style={{ fontSize: 11, color: '#aaa' }}>Camera preview</span>
                </div>
              </div>
              <div className="login-device-links">
                <span>Device settings</span>
                <span>Having trouble?</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-footer">
          {['Terms of Use','Privacy Policy','Security','Cookie policy','Your privacy rights'].map(t => (
            <span key={t} style={{ cursor: 'pointer' }}>{t}</span>
          ))}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════
     MAIN GAME LAYOUT
  ════════════════════════════════════════════════════ */
  return (
    <div className="app-layout">

      {/* ═══ TOP BAR ════════════════════════════════════ */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-logo">🌌</div>
          <span>Upskill Mafia MERN</span>
          <span className="topbar-brand-chevron">▾</span>
        </div>

        <button
          className="topbar-space-btn"
          onClick={() => setShowCallCard(false)}
          title="Back to Space"
        >🏠 Space</button>

        <div className="topbar-center">
          {/* Socker Connection Indicator */}
          <div className={`topbar-status-dot ${socketId ? 'connected' : 'disconnected'}`} title={socketId ? 'Connected to Server' : 'Connecting to Server...'} />
          
          <button className="topbar-audio-btn" title="Audio settings">🎧</button>

          {/* Call button — only active when someone is connected */}
          {Object.keys(remoteUsers).length > 0 ? (
            <button
              className="topbar-call-btn"
              onClick={() => setShowCallCard(v => !v)}
            >
              <span className="topbar-call-dot" />
              📹 Call
            </button>
          ) : (
            <button
              className="topbar-call-btn disabled"
              title="Join a space with others to start a call"
              disabled
            >
              <span className="topbar-call-dot" style={{ background: '#888' }} />
              📹 Call
            </button>
          )}

          <button className="topbar-users-btn">
            👥 {onlineCount}/4 <span style={{ marginLeft: 4, opacity: 0.7 }}>⚠</span>
          </button>
        </div>

        <button className="topbar-icon-btn" title="Expand">⛶</button>
        <button className="topbar-icon-btn" title="Fullscreen">⤢</button>
      </header>

      {/* ═══ BODY ══════════════════════════════════════ */}
      <div className="app-body">

        {/* ─── LEFT SIDEBAR ──────────────────────────── */}
        <aside className="app-sidebar">
          <div className="sidebar-search" onClick={() => setShowSearchModal(true)}>
            <span className="sidebar-search-icon">🔍</span>
            <span className="sidebar-search-text">Search</span>
            <span className="sidebar-search-shortcut">⌘ K</span>
          </div>

          <nav style={{ paddingTop: 4 }}>
            {/* Activities Tab */}
            <div
              className={`sidebar-nav-item ${sidebarTab === 'activities' ? 'active' : ''}`}
              onClick={() => {
                setSidebarTab(p => p === 'activities' ? null : 'activities');
                setSidebarPanel(null);
                if (sidebarTab !== 'activities') setUnreadCount(0);
              }}
            >
              <span className="sidebar-nav-item-icon">🔔</span>
              Activities
              {unreadCount > 0 && (
                <span className="sidebar-nav-item-badge">{unreadCount}</span>
              )}
            </div>

            {/* Recent Conversations Tab */}
            <div
              className={`sidebar-nav-item ${sidebarTab === 'conversations' ? 'active' : ''}`}
              onClick={() => {
                setSidebarTab(p => p === 'conversations' ? null : 'conversations');
                setSidebarPanel(null);
              }}
            >
              <span className="sidebar-nav-item-icon">💬</span>
              Recent Conversations
            </div>

            {/* Today's Calendar */}
            <div
              className={`sidebar-nav-item ${sidebarTab === 'calendar' ? 'active' : ''}`}
              onClick={() => {
                setSidebarTab(p => p === 'calendar' ? null : 'calendar');
                setSidebarPanel(null);
              }}
            >
              <span className="sidebar-nav-item-icon">📅</span>
              Today's Calendar
            </div>
          </nav>

          <div className="sidebar-divider" />

          {/* Rooms */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <span className="sidebar-group-title">▾ Rooms</span>
            </div>
            <div
              className={`sidebar-room-item ${sidebarPanel === 'newcall' ? 'active' : ''}`}
              onClick={() => {
                setSidebarPanel(p => p === 'newcall' ? null : 'newcall');
                setSidebarTab(null);
              }}
            >
              <span className="sidebar-room-icon">📞</span>
              Start New Call
            </div>
            {/* Rooms placeholder (hidden until implemented) */}
          </div>

          {/* New Call Panel REMOVED FROM HERE */}
          <div className="sidebar-divider" />

          {/* Channels */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <span className="sidebar-group-title">▾ Channels</span>
            </div>
            {[
              { key: 'threads',  icon: '💭', label: 'Threads' },
              { key: 'doubts',   icon: '#',    label: 'doubts-discussions' },
              { key: 'general',  icon: '#',    label: 'general-chat' },
            ].map(ch => (
              <div
                key={ch.key}
                className={`sidebar-channel-item ${sidebarPanel === ch.key ? 'active' : ''}`}
                onClick={() => {
                  setSidebarPanel(p => p === ch.key ? null : ch.key);
                  setSidebarTab(null);
                }}
              >
                <span className="sidebar-nav-item-icon">{ch.icon}</span>
                {ch.label}
              </div>
            ))}
          </div>

          {/* Channel Panel REMOVED FROM HERE */}

          <div className="sidebar-divider" />

          {/* Team */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <span className="sidebar-group-title">▾ Team</span>
            </div>

            {/* Self */}
            <div className="sidebar-member">
              <div className="sidebar-member-ava" style={{ background: 'linear-gradient(135deg,#ec4899,#8b5cf6)' }}>
                {userName.charAt(0).toUpperCase()}
                <span className="sidebar-member-status" style={{ background: '#10b981' }} />
              </div>
              <div className="sidebar-member-info">
                <div className="sidebar-member-name">{userName} (me)</div>
                <div className="sidebar-member-room">Spatial</div>
              </div>
              <span className="sidebar-member-tag">GUEST</span>
            </div>

            {Object.values(remoteUsers).map(u => (
              <div key={u.id} className="sidebar-member">
                <div className="sidebar-member-ava" style={{ background: u.color || '#6c3fff' }}>
                  {u.name.charAt(0).toUpperCase()}
                  <span className="sidebar-member-status" style={{ background: '#10b981' }} />
                </div>
                <div className="sidebar-member-info">
                  <div className="sidebar-member-name">{u.name}</div>
                  <div className="sidebar-member-room">Spatial</div>
                </div>
                <div className="sidebar-member-icons">
                  <span className="sidebar-member-icon" title="Hand">✋</span>
                  <span
                    className="sidebar-member-icon"
                    title="Message"
                    onClick={() => { setChatInput(`@${u.name} `); setShowChat(true); }}
                  >→</span>
                </div>
                <span className="sidebar-member-tag">GUEST</span>
              </div>
            ))}

            <div className="sidebar-offline-toggle" onClick={() => setShowOffline(!showOffline)}>
              <span>{showOffline ? '▾' : '▸'}</span>
              Offline
            </div>
          </div>
        </aside>

        {/* ─── CANVAS AREA ──────────────────────────── */}
        <div className="canvas-wrapper">

          <CosmosEngine
            userName={userName}
            remoteUsers={remoteUsers}
            onUpdatePosition={updatePosition}
            zoom={zoom}
            proximityUsers={proximityUsers}
            isHandRaised={isHandRaised}
          />

          {/* ─── RIGHT DASHBOARD PANEL ────────────────── */}
          {(sidebarTab || sidebarPanel) && (
            <div className="dashboard-right">
              <div className="dashboard-right-header">
                <div className="dashboard-right-title-row">
                  {sidebarPanel === 'doubts' ? '# doubts-discussions' :
                   sidebarPanel === 'general' ? '# general-chat' :
                   sidebarPanel === 'threads' ? 'Threads' :
                   sidebarTab === 'conversations' ? 'Recent Conversations' :
                   sidebarTab === 'activities' ? 'Activities' : 'Dashboard'}
                </div>
                <div className="dashboard-right-actions">
                  <button className="dashboard-right-action-btn">📌</button>
                  <button
                    className="dashboard-right-action-btn"
                    onClick={() => { setSidebarTab(null); setSidebarPanel(null); }}
                  >✕</button>
                </div>
              </div>

              <div className="dashboard-right-content">
                {/* Activities Content */}
                {sidebarTab === 'activities' && (
                  <div className="sidebar-activities">
                    {activities.length === 0 ? (
                      <div className="sidebar-empty">No activity yet</div>
                    ) : (
                      activities.map((a, i) => (
                        <div key={a.id || i} className="sidebar-activity-item">
                          <span className="sidebar-activity-icon">{a.icon}</span>
                          <div className="sidebar-activity-info">
                            <div className="sidebar-activity-text">{a.text}</div>
                            <div className="sidebar-activity-time">{fmtTime(a.time)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Recent Conv Content */}
                {sidebarTab === 'conversations' && (
                  <div className="sidebar-conversations">
                    {messages.length === 0 ? (
                      <div className="sidebar-empty">Move near someone to start chatting...</div>
                    ) : (
                      messages.slice().reverse().map((msg, i) => (
                        <div key={msg.id || i} className="sidebar-convo-item">
                          <div className="sidebar-convo-ava">{msg.sender?.charAt(0)?.toUpperCase()}</div>
                          <div className="sidebar-convo-body">
                            <div className="sidebar-convo-header">
                              <span className="sidebar-convo-name">{msg.sender}</span>
                              <span className="sidebar-convo-time">{fmtTime(new Date())}</span>
                            </div>
                            <div className="sidebar-convo-preview">{msg.text}</div>
                            <button className="sidebar-convo-reply" onClick={() => { setChatInput(`@${msg.sender} `); setShowChat(true); }}>↩ Reply</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Calendar Content */}
                {sidebarTab === 'calendar' && (
                  <div className="sidebar-calendar">
                    <div className="calendar-header-row">
                      <span className="calendar-date">{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                      <span className="calendar-day">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</span>
                    </div>
                    <div className="calendar-list">
                      {[
                        { time: '10:00 AM', title: 'MERN Stack Workshop', color: '#6c3fff' },
                        { time: '12:30 PM', title: 'Lunch Break 🍱', color: '#10b981' },
                        { time: '02:00 PM', title: 'UI/UX Design Sync', color: '#ec4899' },
                        { time: '04:30 PM', title: 'Weekly Recap', color: '#f59e0b' },
                      ].map((ev, i) => (
                        <div key={i} className="calendar-event">
                          <div className="event-dot" style={{ background: ev.color }} />
                          <div className="event-info">
                            <div className="event-time">{ev.time}</div>
                            <div className="event-title">{ev.title}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Call Panel */}
                {sidebarPanel === 'newcall' && (
                  <div className="sidebar-panel">
                    <p className="sidebar-panel-desc">Invite someone to a private call.</p>
                    {Object.values(remoteUsers).length === 0 ? (
                      <div className="sidebar-empty">👤 No one else is online</div>
                    ) : (
                      Object.values(remoteUsers).map(u => (
                        <div key={u.id} className="sidebar-call-member">
                          <div className="sidebar-member-ava" style={{ background: u.color || '#6c3fff' }}>{u.name.charAt(0).toUpperCase()}</div>
                          <span className="sidebar-call-name">{u.name}</span>
                          <button className="sidebar-call-btn" onClick={() => setShowCallCard(true)}>📹 Call</button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Channel Content */}
                {['threads','doubts','general'].includes(sidebarPanel) && (
                  <div className="sidebar-panel">
                    <div className="sidebar-panel-body">
                      <div className="sidebar-messages-area">
                        {globalMessages.filter(m => m.channel === sidebarPanel).length === 0 ? (
                          <div className="sidebar-empty-state-large">
                            {sidebarPanel === 'threads' ? 'No threads here yet...' : 'No messages yet.'}
                          </div>
                        ) : (
                          <div className="sidebar-chat-feed">
                            {/* Dummy Welcome Message mimicking screenshot */}
                            {sidebarPanel === 'doubts' && (
                              <div className="chat-welcome-block">
                                <div className="chat-welcome-ava">
                                  {userName.charAt(0).toUpperCase()}
                                  <div className="media-user-status" style={{bottom: 0, right: 0, position: 'absolute', width: 8, height: 8}}/>
                                </div>
                                <h1 className="chat-welcome-title">This is the beginning of your chat history in <span>#doubts-discussions</span>.</h1>
                                <p className="chat-welcome-subtitle">Send messages, attachments, links, emojis, and more.</p>
                              </div>
                            )}

                            {globalMessages.filter(m => m.channel === sidebarPanel).map((msg, i) => (
                              <div key={i} className="chat-message-row">
                                <div className="chat-message-ava">
                                  {msg.sender?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="chat-message-content">
                                  <div className="chat-message-header">
                                    <span className="chat-message-name">{msg.sender}</span>
                                    <span className="chat-message-time">{msg.timestamp || 'Just now'}</span>
                                  </div>
                                  <div className="chat-message-text">{msg.text}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Rich Input Area */}
                      <div className="chat-rich-input-container">
                        <div className="chat-rich-input-wrapper">
                          <input
                            className="chat-rich-input"
                            value={dashboardChatInput}
                            onChange={(e) => setDashboardChatInput(e.target.value)}
                            placeholder={`Message ${sidebarPanel === 'threads' ? '' : '# '}${sidebarPanel === 'doubts' ? 'doubts-discussions' : sidebarPanel}`}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSendDashboardChat();
                            }}
                          />
                          <button 
                            className="chat-rich-send-btn" 
                            onClick={handleSendDashboardChat}
                          >➤</button>
                        </div>
                        <div className="chat-rich-toolbar">
                          <button className="toolbar-btn">😊</button>
                          <button className="toolbar-btn">📤</button>
                          <button className="toolbar-btn">📊</button>
                          <div className="toolbar-divider" />
                          <button className="toolbar-btn font-bold">B</button>
                          <button className="toolbar-btn italic">I</button>
                          <button className="toolbar-btn line-through">S</button>
                          <button className="toolbar-btn">&lt;&gt;</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── SEARCH MODAL ─── */}
          {showSearchModal && (
            <div className="search-modal-backdrop" onClick={() => setShowSearchModal(false)}>
              <div className="search-modal" onClick={e => e.stopPropagation()}>
                <div className="search-modal-header">
                  <span className="search-modal-icon">🔍</span>
                  <input 
                    className="search-modal-input" 
                    placeholder="Search users, rooms, channels, and actions..." 
                    autoFocus
                  />
                </div>
                <div className="search-modal-body">
                  {/* Empty state for search */}
                </div>
                <div className="search-modal-footer">
                  <span className="search-hint"><span className="search-key">↑</span> <span className="search-key">↓</span> to navigate</span>
                  <span className="search-hint"><span className="search-key">ENTER</span> to select</span>
                  <span className="search-hint"><span className="search-key">ESC</span> to close</span>
                  <span className="search-hint"><span className="search-key">CMD / CTRL</span> + <span className="search-key">K</span> to open</span>
                </div>
              </div>
            </div>
          )}

          {/* Avatar Video Overlay — only shows when someone is nearby */}
          {proximityUsers.length > 0 && (
            <div className="avatar-video-overlay proximity-card-enter">
              <div className="avatar-video-card">
                <div className="avatar-video-inner">
                  {!isCameraOff && cameraStream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 52 }}>{isCameraOff ? '👤' : '🧍'}</span>
                  )}
                </div>
                <div
                  className="avatar-hand-badge"
                  onClick={toggleHand}
                  title="Raise/Lower Hand"
                  style={{ background: isHandRaised ? '#f59e0b' : 'rgba(0,0,0,0.5)' }}
                >✋</div>
                <div className="avatar-status-icons">
                  <div
                    className={`avatar-status-icon ${isMuted ? 'muted' : ''}`}
                    onClick={toggleMic}
                    title="Mic"
                  >{isMuted ? '🔇' : '🎤'}</div>
                  <div
                    className={`avatar-status-icon ${isCameraOff ? 'cam-off' : ''}`}
                    onClick={toggleCamera}
                    title="Camera"
                  >{isCameraOff ? '📷' : '🎥'}</div>
                </div>
                <div className="avatar-online-dot" />
                <div className="avatar-video-name">{userName}</div>
              </div>

              {/* Remote users' cards beside self */}
              {proximityUsers.map(u => (
                <div key={u.id} className="avatar-video-card remote-card">
                  <div className="avatar-video-inner" style={{ background: `linear-gradient(135deg, ${u.color || '#6c3fff'}, #1a1a3a)` }}>
                    {remoteStreams[u.id] ? (
                      <video
                        autoPlay
                        playsInline
                        ref={el => { if (el && el.srcObject !== remoteStreams[u.id]) { el.srcObject = remoteStreams[u.id]; el.play().catch(()=>{}); } }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 38, fontWeight: 800, color: '#fff' }}>
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="avatar-online-dot" />
                  <div className="avatar-video-name">{u.name}</div>
                </div>
              ))}
            </div>
          )}

          {/* Proximity Badge + Auto Chat prompt */}
          {proximityUsers.length > 0 && (
            <div className="proximity-badge" style={{ top: 180 }}>
              <span className="proximity-dot" />
              {proximityUsers.map(u => u.name).join(', ')} nearby
              <button
                className="proximity-chat-btn"
                onClick={() => setShowChat(true)}
              >
                💬 Chat
              </button>
            </div>
          )}

          {/* Floating Chat Panel */}
          {showChat && (
            <div className="chat-float">
              <div className="chat-float-header">
                <div>
                  <div className="chat-float-title">Nearby Chat 💬</div>
                  <div className="chat-float-sub">
                    {proximityUsers.length > 0
                      ? `${proximityUsers.map(u=>u.name).join(', ')} nearby`
                      : 'Move close to someone to chat'}
                  </div>
                </div>
                <button className="chat-float-close" onClick={() => setShowChat(false)}>✕</button>
              </div>
              <div className="chat-float-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty-state">No messages yet. Walk up to someone!</div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={msg.id || i} className={`chat-float-msg ${msg.sender === userName ? 'mine' : ''}`}>
                      <div className="chat-float-msg-sender">{msg.sender}</div>
                      <div className="chat-float-msg-text">{msg.text}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-float-input-area">
                <input
                  className="chat-float-input"
                  placeholder={proximityUsers.length > 0 ? 'Type a message...' : 'Move closer to chat...'}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={proximityUsers.length === 0}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.stopPropagation(); handleSendChat(); }
                  }}
                />
                <button
                  className="chat-float-send"
                  onClick={handleSendChat}
                  disabled={proximityUsers.length === 0 || !chatInput.trim()}
                >➤</button>
              </div>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="zoom-controls">
            <div className="zoom-btn" title="Re-center" onClick={() => {}}>⊕</div>
            <div className="zoom-btn" title="Zoom In" onClick={() => setZoom(z => Math.min(z + 0.1, 2.0))}>+</div>
            <div className="zoom-btn zoom-val">{Math.round(zoom * 100)}%</div>
            <div className="zoom-btn" title="Zoom Out" onClick={() => setZoom(z => Math.max(z - 0.1, 0.25))}>−</div>
            <div className="zoom-btn" title="Help" style={{ fontSize: 14 }}>?</div>
          </div>

          {/* ── CALL CARD MODAL ── */}
          {showCallCard && (
            <div className="call-card-backdrop" onClick={() => setShowCallCard(false)}>
              <div className="call-card" onClick={e => e.stopPropagation()}>
                <div className="call-card-header">
                  <div className="call-card-title">📹 Active Call</div>
                  <button className="call-card-close" onClick={() => setShowCallCard(false)}>✕</button>
                </div>
                <div className="call-card-body">
                  <div className="call-card-grid">
                    {/* Local user tile */}
                    <div className="call-tile self-tile">
                      {!isCameraOff && cameraStream ? (
                        <video
                          autoPlay muted playsInline
                          ref={el => { if (el && cameraStream) { el.srcObject = cameraStream; el.play().catch(()=>{}); }}}
                          style={{ width:'100%',height:'100%',objectFit:'cover' }}
                        />
                      ) : (
                        <div className="call-tile-avatar" style={{ background:'linear-gradient(135deg,#ec4899,#8b5cf6)' }}>
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="call-tile-name">{userName} (You)</div>
                      {isMuted && <div className="call-tile-muted">🔇</div>}
                    </div>

                    {/* Remote user tiles */}
                    {Object.values(remoteUsers).map(u => (
                      <div key={u.id} className="call-tile">
                        {remoteStreams[u.id] ? (
                          <video
                            autoPlay
                            playsInline
                            ref={el => { if (el && el.srcObject !== remoteStreams[u.id]) { el.srcObject = remoteStreams[u.id]; el.play().catch(()=>{}); } }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="call-tile-avatar" style={{ background: u.color || '#6c3fff' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="call-tile-name">{u.name}</div>
                      </div>
                    ))}

                    {/* Empty placeholders */}
                    {Object.keys(remoteUsers).length === 0 && (
                      <div className="call-tile empty-tile">
                        <div style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
                          <div style={{fontSize:32,marginBottom:8}}>👤</div>
                          Waiting for others…
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Call controls */}
                  <div className="call-card-controls">
                    <button
                      className={`call-ctrl-btn ${isMuted ? 'danger' : ''}`}
                      onClick={toggleMic}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      <div className="call-ctrl-icon">{isMuted ? '🔇' : '🎙️'}</div>
                      <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <button
                      className={`call-ctrl-btn ${isCameraOff ? 'danger' : ''}`}
                      onClick={toggleCamera}
                      title={isCameraOff ? 'Start Camera' : 'Stop Camera'}
                    >
                      <div className="call-ctrl-icon">{isCameraOff ? '📷' : '🎥'}</div>
                      <span>Camera</span>
                    </button>
                    <button className="call-ctrl-btn">
                      <div className="call-ctrl-icon">🖥️</div>
                      <span>Share</span>
                    </button>
                    <button
                      className="call-ctrl-btn leave"
                      onClick={() => setShowCallCard(false)}
                    >
                      <div className="call-ctrl-icon">📵</div>
                      <span>Leave</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BOTTOM MEDIA BAR ══════════════════════════ */}
      <footer className="bottombar">
        {/* Left: User info */}
        <div className="bottombar-left">
          <button className="media-btn-user" title="Your profile">
            <div className="media-user-ava">
              {userName.charAt(0).toUpperCase()}
              <div className="media-user-status" />
            </div>
            <span className="media-user-name">{userName}</span>
          </button>
        </div>

        {/* Center: Media controls */}
        <div className="bottombar-center">
          <button
            className={`media-btn ${isMuted ? 'danger' : 'active'}`}
            onClick={toggleMic}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <div className="media-btn-icon">{isMuted ? '🔇' : '🎙️'}</div>
            <span className="media-btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className={`media-btn ${isCameraOff ? 'danger' : 'active'}`}
            onClick={toggleCamera}
            title={isCameraOff ? 'Start Camera' : 'Stop Camera'}
          >
            <div className="media-btn-icon">{isCameraOff ? '📷' : '🎥'}</div>
            <span className="media-btn-label">Camera</span>
          </button>

          <button
            className={`media-btn ${isSharingScreen ? 'active' : ''}`}
            onClick={toggleShareScreen}
            title="Share Screen"
          >
            <div className="media-btn-icon">{isSharingScreen ? '🚫' : '🖥️'}</div>
            <span className="media-btn-label">{isSharingScreen ? 'Stop' : 'Share'}</span>
          </button>

          <button
            className={`media-btn ${isHandRaised ? 'active' : ''}`}
            onClick={toggleHand}
            title="Raise Hand"
          >
            <div className="media-btn-icon">✋</div>
            <span className="media-btn-label">Hand</span>
          </button>

          <button className="media-btn" onClick={() => setShowChat(!showChat)} title="Chat">
            <div className="media-btn-icon" style={{ position: 'relative' }}>
              💬
              {messages.length > 0 && (
                <span className="media-badge">{messages.length}</span>
              )}
            </div>
            <span className="media-btn-label">Chat</span>
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className={`media-btn ${showMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="More options"
            >
              <div className="media-btn-icon">•••</div>
              <span className="media-btn-label">More</span>
            </button>

            {showMoreMenu && (
              <div className="more-menu-popup">
                <div className="more-item" onClick={handleResetPosition}>
                  <span className="more-item-icon">📍</span>
                  Reset Position
                </div>
                <div className="more-item" onClick={() => { setHasJoined(false); setShowMoreMenu(false); }}>
                  <span className="more-item-icon">👤</span>
                  Change Name
                </div>
                <div className="more-item" onClick={() => setShowMoreMenu(false)}>
                  <span className="more-item-icon">⚙️</span>
                  Settings
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Leave */}
        <div className="bottombar-right">
          <button
            className="leave-btn"
            onClick={() => {
              mediaStream?.getTracks().forEach(t => t.stop());
              cameraStream?.getTracks().forEach(t => t.stop());
              setHasJoined(false);
              setUserName('');
              setDraft('');
              setMediaStream(null);
              setCameraStream(null);
            }}
          >↪ Leave</button>
        </div>
      </footer>
    </div>
  );
};

export default App;
