import { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

interface MoveHistoryProps {
  onClose: () => void;
}

export default function MoveHistory({ onClose }: MoveHistoryProps) {
  const { game, setCurrentScreen } = useGameStore();
  const [copied, setCopied] = useState<string | null>(null);
  
  const history = game.history();
  const movePairs: { white: string; black?: string; number: number }[] = [];
  
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  const pgn = game.pgn();
  const fen = game.fen();

  const handleCopy = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleDownloadPGN = useCallback(() => {
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-game-${new Date().toISOString().slice(0, 10)}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [pgn]);

  const handleSaveGame = useCallback(() => {
    const games = JSON.parse(localStorage.getItem('chess-games') || '[]');
    const newGame = {
      id: Date.now(),
      pgn,
      fen,
      date: new Date().toISOString(),
      moves: history.length,
      result: game.isCheckmate() 
        ? (game.turn() === 'w' ? '0-1' : '1-0')
        : game.isDraw() 
          ? '1/2-1/2' 
          : '*',
    };
    games.unshift(newGame);
    // Keep only last 50 games
    localStorage.setItem('chess-games', JSON.stringify(games.slice(0, 50)));
    setCopied('save');
    setTimeout(() => setCopied(null), 2000);
  }, [pgn, fen, history, game]);

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div 
        className="w-full bg-chess-panel rounded-t-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1 bg-chess-text-muted rounded-full" />
        </div>
        
        {/* Title */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-chess-bg">
          <h2 className="text-lg font-semibold text-chess-text">Game Info</h2>
          <button 
            onClick={onClose}
            className="text-chess-text-muted hover:text-chess-text"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Move History */}
          <div>
            <h3 className="text-sm text-chess-text-muted mb-2">Move History</h3>
            {movePairs.length === 0 ? (
              <p className="text-chess-text-muted text-center py-4">No moves yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {movePairs.map((pair) => (
                  <div 
                    key={pair.number}
                    className="flex items-center gap-2 p-2 bg-chess-bg rounded"
                  >
                    <span className="text-chess-text-muted w-6 text-sm">{pair.number}.</span>
                    <span className="text-chess-text font-mono w-12">{pair.white}</span>
                    <span className="text-chess-text font-mono w-12">
                      {pair.black || ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export Options */}
          <div className="border-t border-chess-bg pt-4">
            <h3 className="text-sm text-chess-text-muted mb-3">Export</h3>
            
            {/* FEN */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-chess-text-muted">FEN</span>
                <button
                  onClick={() => handleCopy(fen, 'fen')}
                  className="text-xs text-chess-accent hover:underline"
                >
                  {copied === 'fen' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-2 bg-chess-bg rounded text-xs font-mono text-chess-text break-all">
                {fen}
              </div>
            </div>

            {/* PGN */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-chess-text-muted">PGN</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(pgn, 'pgn')}
                    className="text-xs text-chess-accent hover:underline"
                  >
                    {copied === 'pgn' ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownloadPGN}
                    className="text-xs text-chess-accent hover:underline"
                  >
                    Download
                  </button>
                </div>
              </div>
              <div className="p-2 bg-chess-bg rounded text-xs font-mono text-chess-text max-h-32 overflow-y-auto">
                {pgn || 'No moves yet'}
              </div>
            </div>

            {/* Save Game */}
            <button
              onClick={handleSaveGame}
              className={`w-full btn btn-secondary text-sm ${
                copied === 'save' ? 'bg-chess-accent text-white' : ''
              }`}
            >
              {copied === 'save' ? '✓ Saved to History' : '💾 Save Game'}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="border-t border-chess-bg pt-4">
            <h3 className="text-sm text-chess-text-muted mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onClose();
                  // Analysis will be triggered by the engine button
                }}
                className="btn btn-secondary text-sm"
              >
                🔍 Analyze
              </button>
              <button
                onClick={() => handleCopy(window.location.href, 'link')}
                className="btn btn-secondary text-sm"
              >
                {copied === 'link' ? '✓ Copied' : '🔗 Share'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}