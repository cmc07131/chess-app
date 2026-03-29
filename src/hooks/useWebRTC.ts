import { useState, useCallback, useRef, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { compress, decompress } from 'fflate';
import { useGameStore } from '../store/gameStore';

export type ConnectionState = 'idle' | 'creating' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SyncMessage {
  type: 'MOVE' | 'SYNC' | 'RESIGN' | 'DRAW_OFFER' | 'DRAW_ACCEPT' | 'PING' | 'PONG' | 'INIT';
  payload?: any;
  timestamp: number;
}

interface UseWebRTCReturn {
  connectionState: ConnectionState;
  localDescription: string | null;
  remoteDescription: string | null;
  error: string | null;
  createOffer: () => Promise<void>;
  handleOffer: (offerStr: string) => Promise<void>;
  handleAnswer: (answerStr: string) => void;
  sendMessage: (msg: SyncMessage) => void;
  disconnect: () => void;
}

export function useWebRTC(): UseWebRTCReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [localDescription, setLocalDescription] = useState<string | null>(null);
  const [remoteDescription, setRemoteDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const { makeMove, syncGameState, setIsConnected } = useGameStore();
  
  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);
  
  const compressData = useCallback((data: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);
      compress(encoded, { level: 6 }, (err, compressed) => {
        if (err) reject(err);
        else {
          const base64 = btoa(String.fromCharCode(...compressed));
          resolve(base64);
        }
      });
    });
  }, []);
  
  const decompressData = useCallback((data: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        decompress(bytes, (err, decompressed) => {
          if (err) reject(err);
          else {
            const decoder = new TextDecoder();
            resolve(decoder.decode(decompressed));
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }, []);
  
  const handleData = useCallback(async (data: string) => {
    try {
      const decompressed = await decompressData(data);
      const msg: SyncMessage = JSON.parse(decompressed);
      
      switch (msg.type) {
        case 'MOVE':
          if (msg.payload) {
            makeMove(msg.payload.from, msg.payload.to, msg.payload.promotion);
          }
          break;
        case 'SYNC':
          if (msg.payload) {
            syncGameState(msg.payload.fen, msg.payload.moveHistory);
          }
          break;
        case 'RESIGN':
          useGameStore.getState().resignGame();
          break;
        case 'PING':
          sendMessage({ type: 'PONG', timestamp: Date.now() });
          break;
        case 'PONG':
          break;
        case 'INIT':
          // Sync current game state when opponent connects
          const { game } = useGameStore.getState();
          sendMessage({ 
            type: 'SYNC', 
            payload: { fen: game.fen(), moveHistory: game.history() },
            timestamp: Date.now()
          });
          break;
      }
    } catch (e) {
      console.error('Error handling data:', e);
    }
  }, [makeMove, syncGameState, decompressData]);
  
  const sendMessage = useCallback(async (msg: SyncMessage) => {
    if (peerRef.current && connectionState === 'connected') {
      try {
        const compressed = await compressData(JSON.stringify(msg));
        peerRef.current.send(compressed);
      } catch (e) {
        console.error('Error sending message:', e);
      }
    }
  }, [connectionState, compressData]);
  
  const createOffer = useCallback(async () => {
    try {
      setConnectionState('creating');
      setError(null);
      
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        config: { 
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ] 
        }
      });
      
      peer.on('signal', async (data) => {
        const compressed = await compressData(JSON.stringify(data));
        setLocalDescription(compressed);
        setConnectionState('waiting');
      });
      
      peer.on('connect', () => {
        setConnectionState('connected');
        setIsConnected(true);
        sendMessage({ type: 'INIT', timestamp: Date.now() });
      });
      
      peer.on('data', (data) => {
        handleData(data.toString());
      });
      
      peer.on('error', (err) => {
        setError(err.message);
        setConnectionState('error');
        setIsConnected(false);
      });
      
      peer.on('close', () => {
        setConnectionState('disconnected');
        setIsConnected(false);
      });
      
      peerRef.current = peer;
    } catch (e: any) {
      setError(e.message || 'Failed to create offer');
      setConnectionState('error');
    }
  }, [compressData, handleData, sendMessage, setIsConnected]);
  
  const handleOffer = useCallback(async (offerStr: string) => {
    try {
      setConnectionState('connecting');
      setError(null);
      setRemoteDescription(offerStr);
      
      const decompressed = await decompressData(offerStr);
      const offer = JSON.parse(decompressed);
      
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        config: { 
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ] 
        }
      });
      
      peer.on('signal', async (data) => {
        const compressed = await compressData(JSON.stringify(data));
        setLocalDescription(compressed);
      });
      
      peer.on('connect', () => {
        setConnectionState('connected');
        setIsConnected(true);
        sendMessage({ type: 'INIT', timestamp: Date.now() });
      });
      
      peer.on('data', (data) => {
        handleData(data.toString());
      });
      
      peer.on('error', (err) => {
        setError(err.message);
        setConnectionState('error');
        setIsConnected(false);
      });
      
      peer.on('close', () => {
        setConnectionState('disconnected');
        setIsConnected(false);
      });
      
      peer.signal(offer);
      peerRef.current = peer;
    } catch (e: any) {
      setError(e.message || 'Failed to handle offer');
      setConnectionState('error');
    }
  }, [decompressData, handleData, sendMessage, setIsConnected]);
  
  const handleAnswer = useCallback(async (answerStr: string) => {
    try {
      const decompressed = await decompressData(answerStr);
      const answer = JSON.parse(decompressed);
      
      if (peerRef.current) {
        peerRef.current.signal(answer);
        setConnectionState('connecting');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to handle answer');
      setConnectionState('error');
    }
  }, [decompressData]);
  
  const disconnect = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setConnectionState('idle');
    setLocalDescription(null);
    setRemoteDescription(null);
    setError(null);
    setIsConnected(false);
  }, [setIsConnected]);
  
  return {
    connectionState,
    localDescription,
    remoteDescription,
    error,
    createOffer,
    handleOffer,
    handleAnswer,
    sendMessage,
    disconnect,
  };
}