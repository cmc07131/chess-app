import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useGameStore } from '../store/gameStore';
import { useWebRTC } from '../hooks/useWebRTC';

type ConnectionMode = 'create' | 'join' | null;

export default function ConnectionPanel() {
  const { setCurrentScreen, initGame } = useGameStore();
  const { 
    createOffer, 
    handleOffer, 
    connectionState, 
    localDescription,
    error 
  } = useWebRTC();
  
  const [mode, setMode] = useState<ConnectionMode>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showScanner && scannerDivRef.current && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      
      scannerRef.current.render(
        (decodedText) => {
          handleOffer(decodedText);
          setShowScanner(false);
          if (scannerRef.current) {
            scannerRef.current.clear();
            scannerRef.current = null;
          }
        },
        () => {}
      );
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [showScanner, handleOffer]);

  const handleCreateGame = async () => {
    setMode('create');
    await createOffer();
  };

  const handleJoinGame = () => {
    setMode('join');
    setShowScanner(true);
  };

  const handleManualJoin = () => {
    if (manualCode.trim()) {
      handleOffer(manualCode.trim());
    }
  };

  const handleScanAnswer = () => {
    setShowScanner(true);
  };

  // When connected, start the game
  useEffect(() => {
    if (connectionState === 'connected') {
      // Creator is white, joiner is black
      initGame('online', mode === 'create' ? 'white' : 'black');
    }
  }, [connectionState, initGame, mode]);

  return (
    <div className="flex-1 flex flex-col p-6 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => {
            setCurrentScreen('home');
            setMode(null);
          }}
          className="text-chess-text-muted hover:text-chess-text"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-chess-text">Play with Friend</h1>
        <div className="w-8" />
      </div>

      {connectionState === 'connecting' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-chess-text text-lg">Connecting...</p>
          <p className="text-chess-text-muted text-sm mt-2">Waiting for opponent</p>
        </div>
      )}

      {connectionState === 'connected' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-chess-text text-lg">Connected!</p>
          <p className="text-chess-text-muted text-sm mt-2">Starting game...</p>
        </div>
      )}

      {connectionState !== 'connecting' && connectionState !== 'connected' && !mode && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-6xl mb-4">♟️</div>
          
          <button
            onClick={handleCreateGame}
            className="btn btn-primary w-full max-w-sm"
          >
            Create Game
          </button>
          
          <button
            onClick={handleJoinGame}
            className="btn btn-secondary w-full max-w-sm"
          >
            Join Game
          </button>
          
          <div className="text-center text-chess-text-muted text-sm mt-8">
            <p>Both devices must be on the same local network</p>
            <p className="mt-1">or create a mobile hotspot</p>
          </div>
        </div>
      )}

      {mode === 'create' && connectionState !== 'connecting' && connectionState !== 'connected' && (
        <div className="flex-1 flex flex-col items-center">
          <p className="text-chess-text mb-4">Share this code with your friend:</p>
          
          {localDescription && (
            <>
              <div className="bg-white p-4 rounded-xl mb-4">
                <QRCodeSVG 
                  value={localDescription} 
                  size={200}
                  level="L"
                />
              </div>
              
              <div className="w-full max-w-sm mb-4">
                <p className="text-chess-text-muted text-xs mb-2">Or copy code manually:</p>
                <textarea
                  readOnly
                  value={localDescription}
                  className="w-full h-20 p-3 bg-chess-panel text-chess-text text-xs rounded-lg resize-none"
                />
              </div>
              
              <button
                onClick={handleScanAnswer}
                className="btn btn-primary w-full max-w-sm"
              >
                Scan Friend's Response
              </button>
            </>
          )}
          
          {!localDescription && (
            <div className="flex items-center gap-2 text-chess-text-muted">
              <div className="animate-spin">⏳</div>
              <span>Generating connection code...</span>
            </div>
          )}
        </div>
      )}

      {mode === 'join' && !showScanner && connectionState !== 'connecting' && connectionState !== 'connected' && (
        <div className="flex-1 flex flex-col items-center">
          <p className="text-chess-text mb-4">Enter the code from your friend:</p>
          
          <div className="w-full max-w-sm space-y-4">
            <textarea
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste connection code here..."
              className="w-full h-32 p-3 bg-chess-panel text-chess-text rounded-lg resize-none"
            />
            
            <button
              onClick={handleManualJoin}
              disabled={!manualCode.trim()}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              Connect
            </button>
            
            <div className="text-center text-chess-text-muted">or</div>
            
            <button
              onClick={() => setShowScanner(true)}
              className="btn btn-secondary w-full"
            >
              Scan QR Code
            </button>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="flex-1 flex flex-col items-center">
          <p className="text-chess-text mb-4">Point camera at QR code:</p>
          <div 
            id="qr-reader" 
            ref={scannerDivRef}
            className="w-full max-w-sm"
          />
          <button
            onClick={() => {
              setShowScanner(false);
              if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {});
                scannerRef.current = null;
              }
            }}
            className="btn btn-secondary mt-4"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}