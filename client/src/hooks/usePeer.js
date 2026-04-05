import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export const usePeer = (socketId, localStream) => {
  const [peerInstance, setPeerInstance] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
  const callsRef = useRef({});

  useEffect(() => {
    if (!socketId) return;

    // Use socketId as Peer ID for easy lookup
    const peer = new Peer(socketId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true
    });

    peer.on('open', (id) => {
      console.log('PeerJS connected with ID:', id);
    });

    peer.on('call', (call) => {
      // Answer with our stream if available
      call.answer(localStream);
      
      call.on('stream', (remoteStream) => {
        setRemoteStreams(prev => ({
          ...prev,
          [call.peer]: remoteStream
        }));
      });

      call.on('close', () => {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[call.peer];
          return next;
        });
      });

      callsRef.current[call.peer] = call;
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });

    setPeerInstance(peer);

    return () => {
      peer.destroy();
    };
  }, [socketId]);

  // When local stream changes, ideally replace tracks, but for simplicity here if we had calls:
  // (In a full scale app we'd use sender.replaceTrack). PeerJS does not make replaceTrack easy on existing calls, 
  // so often people re-call or we just pass the updated localStream to future calls.

  const callUser = (remoteSocketId, stream) => {
    if (!peerInstance || !stream) return;
    
    // If we already have a call, replace tracks
    if (callsRef.current[remoteSocketId]) {
      const pc = callsRef.current[remoteSocketId].peerConnection;
      if (pc) {
        const senders = pc.getSenders();
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(()=>{});
          } else {
            pc.addTrack(track, stream);
          }
        });
      }
      return; 
    }

    const call = peerInstance.call(remoteSocketId, stream);
    
    call.on('stream', (remoteStream) => {
      setRemoteStreams(prev => ({
        ...prev,
        [remoteSocketId]: remoteStream
      }));
    });

    call.on('close', () => {
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[remoteSocketId];
        return next;
      });
      delete callsRef.current[remoteSocketId];
    });

    callsRef.current[remoteSocketId] = call;
  };

  const removeUserStream = (remoteSocketId) => {
    if (callsRef.current[remoteSocketId]) {
      callsRef.current[remoteSocketId].close();
      delete callsRef.current[remoteSocketId];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[remoteSocketId];
      return next;
    });
  };

  return { peerInstance, remoteStreams, callUser, removeUserStream };
};
