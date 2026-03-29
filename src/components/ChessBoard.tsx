import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import { useChessEngine } from '../hooks/useChessEngine';
import MoveHistory from './MoveHistory';
import AnalysisPanel from './AnalysisPanel';

const PIECE_SYMBOLS: Record<string, string> = {
  'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟',
};

const PIECE_VALUES: Record<string, number> = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 };
const DEPTH_OPTIONS = [10, 14, 18, 22];

const TIME_CONTROLS = [
  { label: '1 min', time: 60, increment: 0 },
  { label: '1|1', time: 60, increment: 1 },
  { label: '2|1', time: 120, increment: 1 },
  { label: '3 min', time: 180, increment: 0 },
  { label: '3|2', time: 180, increment: 2 },
  { label: '5 min', time: 300, increment: 0 },
  { label: '5|5', time: 300, increment: 5 },
  { label: '10 min', time: 600, increment: 0 },
  { label: '10|5', time: 600, increment: 5 },
  { label: '15|10', time: 900, increment: 10 },
  { label: '30 min', time: 1800, increment: 0 },
];

interface ClockState {
  white: number;
  black: number;
  isRunning: boolean;
  activeColor: 'w' | 'b' | null;
  increment: number;
}

// Convert UCI move to standard algebraic notation
function uciToSan(uci: string, fen: string): string {
  if (!uci || uci.length < 4) return uci;
  try {
    const tempGame = new Chess(fen);
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = tempGame.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

export default function ChessBoard() {
  const { game, makeMove, resetGame, resignGame, gameMode, playerColor, isMyTurn, gameStatus, winner: _winner, lastMove, setCurrentScreen, engineEnabled, setEngineEnabled } = useGameStore();
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [engineDepth, setEngineDepth] = useState(18);
  const { isAnalyzing, evaluation, startAnalysis, stopAnalysis } = useChessEngine();
  const [clock, setClock] = useState<ClockState>({ white: 600, black: 600, isRunning: false, activeColor: null, increment: 0 });
  const [selectedTimeControl, setSelectedTimeControl] = useState(3); // Default 10 min
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means at current position
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const position = game.fen();
  const moveHistory = game.history();
  
  // Get the position at a specific history index
  const getPositionAtIndex = useCallback((index: number) => {
    if (index < 0 || index >= moveHistory.length) return position;
    const tempGame = new Chess();
    for (let i = 0; i <= index; i++) {
      tempGame.move(moveHistory[i]);
    }
    return tempGame.fen();
  }, [moveHistory, position]);
  
  // Display position based on history index
  const displayPosition = historyIndex >= 0 ? getPositionAtIndex(historyIndex) : position;

  // Detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize clock from time control
  useEffect(() => {
    const tc = TIME_CONTROLS[selectedTimeControl];
    setClock({ white: tc.time, black: tc.time, isRunning: false, activeColor: null, increment: tc.increment });
  }, [selectedTimeControl]);

  // Clock logic
  useEffect(() => {
    if (clock.isRunning && clock.activeColor) {
      clockIntervalRef.current = setInterval(() => {
        setClock(prev => {
          const color = prev.activeColor!;
          const currentTime = color === 'w' ? prev.white : prev.black;
          const newTime = currentTime - 1;
          if (newTime <= 0) {
            return { ...prev, [color === 'w' ? 'white' : 'black']: 0, isRunning: false };
          }
          return { ...prev, [color === 'w' ? 'white' : 'black']: newTime };
        });
      }, 1000);
    }
    return () => { if (clockIntervalRef.current) clearInterval(clockIntervalRef.current); };
  }, [clock.isRunning, clock.activeColor]);

  // Start clock when game starts
  useEffect(() => {
    if (gameStatus === 'playing' && gameMode === 'pass-and-play') {
      setClock(prev => ({ ...prev, isRunning: true, activeColor: game.turn() }));
    } else if (gameStatus !== 'playing') {
      setClock(prev => ({ ...prev, isRunning: false }));
    }
  }, [gameStatus, gameMode]);

  // Add increment when move is made
  useEffect(() => {
    if (clock.increment > 0 && moveHistory.length > 0 && gameStatus === 'playing') {
      const lastTurn = moveHistory.length % 2 === 0 ? 'b' : 'w';
      setClock(prev => ({
        ...prev,
        [lastTurn === 'w' ? 'white' : 'black']: prev[lastTurn === 'w' ? 'white' : 'black'] + clock.increment
      }));
    }
  }, [moveHistory.length]);

  // Update active color after each move
  useEffect(() => {
    if (gameStatus === 'playing') {
      setClock(prev => ({ ...prev, activeColor: game.turn() }));
    }
  }, [moveHistory.length, gameStatus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Navigation functions - only update historyIndex, don't modify game state
  const goToStart = useCallback(() => {
    if (moveHistory.length > 0) {
      setHistoryIndex(0);
    }
  }, [moveHistory.length]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    } else if (historyIndex === -1 && moveHistory.length > 0) {
      // Start from the end
      setHistoryIndex(moveHistory.length - 2);
    }
  }, [historyIndex, moveHistory.length]);

  const goForward = useCallback(() => {
    if (historyIndex >= 0 && historyIndex < moveHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
    } else if (historyIndex === moveHistory.length - 1) {
      // Go back to current position
      setHistoryIndex(-1);
    }
  }, [historyIndex, moveHistory.length]);

  const goToEnd = useCallback(() => {
    setHistoryIndex(-1); // -1 means current/latest position
  }, []);

  const evalBarPercent = useMemo(() => {
    if (!evaluation) return 50;
    if (evaluation.mate !== null) return evaluation.mate > 0 ? 100 : 0;
    if (evaluation.score !== null) return Math.max(5, Math.min(95, 50 + (evaluation.score / 100) * 10));
    return 50;
  }, [evaluation]);

  const evalText = useMemo(() => {
    if (!evaluation) return '0.00';
    if (evaluation.mate !== null) {
      // Mate score is from perspective of side to move
      const displayMate = evaluation.turn === 'b' ? -evaluation.mate : evaluation.mate;
      return displayMate > 0 ? `M${Math.abs(displayMate)}` : `M${Math.abs(displayMate)}`;
    }
    if (evaluation.score !== null) {
      // Flip score for black's perspective (score is always from side to move)
      const displayScore = evaluation.turn === 'b' ? -evaluation.score : evaluation.score;
      const pawns = displayScore / 100;
      return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
    }
    return '0.00';
  }, [evaluation]);

  // Convert best line UCI moves to SAN
  const formattedBestLine = useMemo(() => {
    if (!evaluation?.bestLine?.length) return '';
    const sanMoves: string[] = [];
    let tempFen = position;
    for (const uciMove of evaluation.bestLine.slice(0, 10)) {
      const san = uciToSan(uciMove, tempFen);
      sanMoves.push(san);
      try {
        const tempGame = new Chess(tempFen);
        tempGame.move(uciMove);
        tempFen = tempGame.fen();
      } catch { break; }
    }
    return sanMoves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i/2)+1}. ${m}` : m)).join(' ');
  }, [evaluation, position]);

  const customSquareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selectedSquare) s[selectedSquare] = { backgroundColor: 'rgba(255,255,0,0.6)' };
    if (lastMove) { s[lastMove.from] = { backgroundColor: 'rgba(255,255,0,0.4)' }; s[lastMove.to] = { backgroundColor: 'rgba(255,255,0,0.4)' }; }
    if (engineEnabled && evaluation?.bestMove && evaluation.bestMove.length >= 4) {
      s[evaluation.bestMove.substring(0,2)] = { backgroundColor: 'rgba(0,255,0,0.4)' };
      s[evaluation.bestMove.substring(2,4)] = { backgroundColor: 'rgba(0,255,0,0.4)' };
    }
    if (game.isCheck()) {
      const board = game.board();
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const p = board[i][j];
        if (p?.type === 'k' && p.color === game.turn()) s[String.fromCharCode(97+j)+(8-i)] = { backgroundColor: 'rgba(255,0,0,0.5)' };
      }
    }
    return s;
  }, [game, lastMove, selectedSquare, engineEnabled, evaluation]);

  const onDrop = useCallback((from: string, to: string) => {
    if (gameStatus !== 'playing' || (gameMode === 'online' && !isMyTurn)) return false;
    
    // If viewing a historical position, need to reset to that position first
    if (historyIndex >= 0 && historyIndex < moveHistory.length - 1) {
      // Reset game to that position by replaying moves
      const tempGame = new Chess();
      for (let i = 0; i <= historyIndex; i++) {
        tempGame.move(moveHistory[i]);
      }
      // Sync the game state
      useGameStore.getState().syncGameState(tempGame.fen(), moveHistory.slice(0, historyIndex + 1));
      setHistoryIndex(-1);
    }
    
    const move = makeMove(from, to);
    if (move) {
      setSelectedSquare(null);
      setHistoryIndex(-1); // Go to current position after making a move
    }
    return move;
  }, [gameStatus, gameMode, isMyTurn, makeMove, moveHistory, historyIndex, getPositionAtIndex]);

  const onPieceClick = useCallback((piece: string, square: string) => {
    if (gameStatus !== 'playing' || (gameMode === 'online' && !isMyTurn)) return;
    
    // If viewing a historical position, need to reset to that position first
    if (historyIndex >= 0 && historyIndex < moveHistory.length - 1) {
      const tempGame = new Chess();
      for (let i = 0; i <= historyIndex; i++) {
        tempGame.move(moveHistory[i]);
      }
      useGameStore.getState().syncGameState(tempGame.fen(), moveHistory.slice(0, historyIndex + 1));
      setHistoryIndex(-1);
    }
    
    const isWhite = piece[0] === 'w';
    const isOwn = gameMode === 'pass-and-play' ? (game.turn() === 'w' ? isWhite : !isWhite) : (playerColor === 'white' ? isWhite : !isWhite);
    if (isOwn) setSelectedSquare(square);
    else if (selectedSquare && makeMove(selectedSquare, square)) {
      setSelectedSquare(null);
      setHistoryIndex(-1);
    }
  }, [gameStatus, gameMode, isMyTurn, playerColor, selectedSquare, makeMove, game, moveHistory, historyIndex]);

  const onSquareClick = useCallback((square: string) => {
    if (gameStatus !== 'playing' || (gameMode === 'online' && !isMyTurn)) return;
    
    // If viewing a historical position, need to reset to that position first
    if (historyIndex >= 0 && historyIndex < moveHistory.length - 1) {
      const tempGame = new Chess();
      for (let i = 0; i <= historyIndex; i++) {
        tempGame.move(moveHistory[i]);
      }
      useGameStore.getState().syncGameState(tempGame.fen(), moveHistory.slice(0, historyIndex + 1));
      setHistoryIndex(-1);
    }
    
    if (selectedSquare) {
      if (makeMove(selectedSquare, square)) { setSelectedSquare(null); setHistoryIndex(-1); }
      else { const p = game.get(square as any); if (p) { const own = gameMode === 'pass-and-play' ? (game.turn() === 'w' ? p.color === 'w' : p.color === 'b') : (playerColor === 'white' ? p.color === 'w' : p.color === 'b'); if (own) setSelectedSquare(square); } }
    } else { const p = game.get(square as any); if (p) { const own = gameMode === 'pass-and-play' ? (game.turn() === 'w' ? p.color === 'w' : p.color === 'b') : (playerColor === 'white' ? p.color === 'w' : p.color === 'b'); if (own) setSelectedSquare(square); } }
  }, [gameStatus, gameMode, isMyTurn, playerColor, selectedSquare, game, makeMove, moveHistory, historyIndex]);

  // const getStatusMessage = () => {
  //   if (gameStatus === 'checkmate') return `Checkmate! ${winner === 'white' ? 'White' : 'Black'} wins!`;
  //   if (gameStatus === 'draw') return 'Draw!';
  //   if (gameStatus === 'resigned') return `${winner === 'white' ? 'Black' : 'White'} resigned.`;
  //   if (gameStatus === 'waiting') return 'Waiting for opponent...';
  //   if (game.isCheck()) return 'Check!';
  //   if (gameMode === 'pass-and-play') return `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
  //   return isMyTurn ? 'Your turn' : "Opponent's turn";
  // };

  const capturedPieces = useMemo(() => {
    const h = game.history({ verbose: true });
    const c: { white: string[]; black: string[] } = { white: [], black: [] };
    let wm = 0, bm = 0;
    h.forEach(m => { if (m.captured) { const v = PIECE_VALUES[m.captured.toLowerCase()] || 0; if (m.color === 'w') { c.black.push(PIECE_SYMBOLS['b'+m.captured.toUpperCase()]||''); wm += v; } else { c.white.push(PIECE_SYMBOLS['w'+m.captured.toUpperCase()]||''); bm += v; } } });
    const o = ['♛','♕','♜','♖','♝','♗','♞','♘','♟','♙'];
    c.white.sort((a,b) => o.indexOf(a)-o.indexOf(b)); c.black.sort((a,b) => o.indexOf(a)-o.indexOf(b));
    return { ...c, whiteAdvantage: wm-bm, blackAdvantage: bm-wm };
  }, [game]);

  useEffect(() => { 
    if (engineEnabled && gameStatus === 'playing') {
      const turn = game.turn() === 'w' ? 'w' : 'b';
      startAnalysis(position, engineDepth, turn); 
    } else {
      stopAnalysis(); 
    }
  }, [engineEnabled, position, gameStatus, engineDepth, startAnalysis, stopAnalysis, game]);

  const movePairs = useMemo(() => {
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      pairs.push({ num: Math.floor(i/2) + 1, white: moveHistory[i], black: moveHistory[i+1] });
    }
    return pairs;
  }, [moveHistory]);

  return (
    <div className="h-screen flex flex-col bg-chess-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-chess-panel border-b border-gray-700">
        <button onClick={() => setCurrentScreen('home')} className="text-chess-text-muted hover:text-chess-text text-sm">← Back</button>
        <h1 className="text-sm font-semibold text-chess-text">Chess</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAnalysis(!showAnalysis)} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${showAnalysis ? 'bg-chess-accent text-white' : 'bg-chess-bg text-chess-text-muted'}`}>📊</button>
          <button onClick={() => setEngineEnabled(!engineEnabled)} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${engineEnabled ? 'bg-chess-accent text-white' : 'bg-chess-bg text-chess-text-muted'}`}>🔍</button>
          <button onClick={() => setShowHistory(!showHistory)} className="text-chess-text-muted hover:text-chess-text text-sm">☰</button>
        </div>
      </div>

      {/* Main content - horizontal split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side - Board */}
        <div className={`${showAnalysis && !isMobile ? 'w-[70%]' : 'w-full'} flex flex-col transition-all duration-300`}>
          {/* Opponent clock & info */}
          <div className="flex items-center justify-between px-4 py-2 bg-chess-panel/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-chess-panel flex items-center justify-center text-lg">{gameMode === 'pass-and-play' ? '👤' : '🤖'}</div>
              <div>
                <div className="text-chess-text text-sm font-medium">{gameMode === 'pass-and-play' ? (playerColor === 'white' ? 'Black' : 'White') : 'Opponent'}</div>
                <div className="text-chess-text text-sm flex gap-1 items-center">
                  {capturedPieces.black.map((p, i) => <span key={i} className="text-lg">{p}</span>)}
                  {capturedPieces.whiteAdvantage > 0 && <span className="text-chess-accent font-bold">+{capturedPieces.whiteAdvantage}</span>}
                </div>
              </div>
            </div>
            <div className={`text-2xl font-mono font-bold px-3 py-1 rounded ${clock.activeColor === 'b' ? 'bg-chess-accent text-white animate-pulse' : 'bg-chess-panel text-chess-text'}`}>{formatTime(clock.black)}</div>
          </div>

          {/* Chess board with eval bar */}
          <div className="flex-1 flex items-center justify-center p-2">
            <div className="flex items-stretch">
            {engineEnabled && (
              <div className="w-4 sm:w-6 mr-1 sm:mr-2 rounded-l overflow-hidden flex flex-col-reverse bg-gray-800">
                <div className="bg-white transition-all duration-300" style={{ height: `${evalBarPercent}%` }} />
              </div>
            )}
            <div style={{ width: 'min(85vw, 85vh - 200px)', maxWidth: '500px', aspectRatio: '1' }}>
              <Chessboard id="chess-board" position={displayPosition} onPieceDrop={onDrop} onPieceClick={onPieceClick} onSquareClick={onSquareClick} boardOrientation={playerColor === 'black' ? 'black' : 'white'} customSquareStyles={customSquareStyles} customBoardStyle={{ borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }} customDarkSquareStyle={{ backgroundColor: '#769656' }} customLightSquareStyle={{ backgroundColor: '#eeeed2' }} />
            </div>
            </div>
          </div>

          {/* Player clock & info */}
          <div className="flex items-center justify-between px-4 py-2 bg-chess-panel/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-chess-panel flex items-center justify-center text-lg">👤</div>
              <div>
                <div className="text-chess-text text-sm font-medium">{gameMode === 'pass-and-play' ? (playerColor === 'white' ? 'White' : 'Black') : 'You'}</div>
                <div className="text-chess-text text-sm flex gap-1 items-center">
                  {capturedPieces.white.map((p, i) => <span key={i} className="text-lg">{p}</span>)}
                  {capturedPieces.blackAdvantage > 0 && <span className="text-chess-accent font-bold">+{capturedPieces.blackAdvantage}</span>}
                </div>
              </div>
            </div>
            <div className={`text-2xl font-mono font-bold px-3 py-1 rounded ${clock.activeColor === 'w' ? 'bg-chess-accent text-white animate-pulse' : 'bg-chess-panel text-chess-text'}`}>{formatTime(clock.white)}</div>
          </div>

          {/* Navigation & Time Control */}
          <div className="flex items-center justify-between px-4 py-2 bg-chess-panel/30">
            <div className="flex items-center gap-1">
              <button onClick={goToStart} className="px-2 py-1 rounded bg-chess-panel text-chess-text-muted hover:text-chess-text text-xs">⏮</button>
              <button onClick={goBack} className="px-2 py-1 rounded bg-chess-panel text-chess-text-muted hover:text-chess-text text-xs">◀</button>
              <span className="text-chess-text-muted text-xs mx-2">{historyIndex}/{moveHistory.length}</span>
              <button onClick={goForward} className="px-2 py-1 rounded bg-chess-panel text-chess-text-muted hover:text-chess-text text-xs">▶</button>
              <button onClick={goToEnd} className="px-2 py-1 rounded bg-chess-panel text-chess-text-muted hover:text-chess-text text-xs">⏭</button>
            </div>
            <select value={selectedTimeControl} onChange={(e) => setSelectedTimeControl(Number(e.target.value))} className="bg-chess-panel text-chess-text text-xs px-2 py-1 rounded">
              {TIME_CONTROLS.map((tc, i) => <option key={i} value={i}>{tc.label}</option>)}
            </select>
          </div>
        </div>

        {/* Right side - Analysis Panel (Desktop only) */}
        {showAnalysis && !isMobile && (
        <div className="w-[30%] bg-chess-panel border-l border-gray-700 flex flex-col overflow-hidden">
          {/* Engine header */}
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-chess-text text-xs font-medium">Stockfish 18 Lite</span>
              <select value={engineDepth} onChange={(e) => setEngineDepth(Number(e.target.value))} className="bg-chess-bg text-chess-text text-xs px-1 py-0.5 rounded">
                {DEPTH_OPTIONS.map(d => <option key={d} value={d}>Depth {d}</option>)}
              </select>
            </div>
            {isAnalyzing && <span className="text-chess-accent text-xs animate-pulse">●</span>}
          </div>

          {/* Evaluation */}
          <div className="px-3 py-3 border-b border-gray-700">
            <div className={`text-2xl font-mono font-bold mb-1 ${evaluation?.score && evaluation.score > 0 ? 'text-chess-accent' : evaluation?.score && evaluation.score < 0 ? 'text-red-400' : 'text-chess-text'}`}>{evalText}</div>
            {formattedBestLine && <div className="text-xs text-chess-text-muted leading-relaxed">{formattedBestLine}</div>}
          </div>

          {/* Best moves list */}
          <div className="px-3 py-2 border-b border-gray-700">
            <div className="text-xs text-chess-text-muted mb-2">Top Moves</div>
            {evaluation && (
              <div className="space-y-1">
                <div className="bg-chess-bg rounded px-2 py-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-chess-accent text-xs font-mono font-bold">{evalText}</span>
                    <span className="text-chess-text text-xs font-mono">{evaluation.bestMove ? uciToSan(evaluation.bestMove, position) : '...'}</span>
                  </div>
                  {formattedBestLine && <div className="text-[10px] text-chess-text-muted truncate">{formattedBestLine}</div>}
                </div>
                <div className="bg-chess-bg/50 rounded px-2 py-1.5 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-chess-text text-xs font-mono">+0.03</span>
                    <span className="text-chess-text text-xs font-mono">...</span>
                  </div>
                </div>
                <div className="bg-chess-bg/50 rounded px-2 py-1.5 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-chess-text text-xs font-mono">+0.01</span>
                    <span className="text-chess-text text-xs font-mono">...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Move list */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="text-xs text-chess-text-muted mb-2">Moves</div>
            <div className="text-xs font-mono text-chess-text space-y-0.5">
              {movePairs.map((pair, i) => (
                <div key={i} className={`flex gap-2 ${i === movePairs.length - 1 ? 'text-chess-accent font-bold' : ''}`}>
                  <span className="text-chess-text-muted w-6">{pair.num}.</span>
                  <span className="w-10">{pair.white}</span>
                  <span className="w-10">{pair.black || ''}</span>
                </div>
              ))}
              {movePairs.length === 0 && <div className="text-chess-text-muted">No moves yet</div>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-3 py-2 border-t border-gray-700 flex gap-2">
            <button onClick={resetGame} className="flex-1 py-1.5 rounded bg-chess-bg text-chess-text text-xs font-medium hover:bg-gray-700">New Game</button>
            <button onClick={resignGame} className="flex-1 py-1.5 rounded bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30">Resign</button>
          </div>
        </div>
        )}

      {/* Mobile Analysis Panel (Modal) */}
      {showAnalysis && isMobile && (
        <AnalysisPanel onClose={() => setShowAnalysis(false)} />
      )}
      </div>

      {showHistory && <MoveHistory onClose={() => setShowHistory(false)} />}
    </div>
  );
}
