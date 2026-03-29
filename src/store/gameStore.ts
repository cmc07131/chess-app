import { create } from 'zustand';
import { Chess } from 'chess.js';

export type GameMode = 'pass-and-play' | 'online' | null;
export type Screen = 'home' | 'game' | 'connect';
export type PlayerColor = 'white' | 'black';

interface GameState {
  // Screen state
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  
  // Game state
  game: Chess;
  gameMode: GameMode;
  playerColor: PlayerColor;
  isMyTurn: boolean;
  lastMove: { from: string; to: string } | null;
  gameStatus: 'playing' | 'checkmate' | 'draw' | 'resigned' | 'waiting';
  winner: PlayerColor | null;
  
  // Engine state
  engineEnabled: boolean;
  setEngineEnabled: (enabled: boolean) => void;
  
  // Connection state
  roomId: string | null;
  isHost: boolean;
  isConnected: boolean;
  peerId: string | null;
  
  // Actions
  initGame: (mode: GameMode, color?: PlayerColor) => void;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  resetGame: () => void;
  resignGame: () => void;
  setRoomId: (id: string | null) => void;
  setIsHost: (isHost: boolean) => void;
  setIsConnected: (connected: boolean) => void;
  setPeerId: (id: string | null) => void;
  setLastMove: (move: { from: string; to: string } | null) => void;
  syncGameState: (fen: string, moveHistory: string[]) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Screen state
  currentScreen: 'home',
  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  
  // Game state
  game: new Chess(),
  gameMode: null,
  playerColor: 'white',
  isMyTurn: true,
  lastMove: null,
  gameStatus: 'playing',
  winner: null,
  
  // Engine state
  engineEnabled: false,
  setEngineEnabled: (enabled) => set({ engineEnabled: enabled }),
  
  // Connection state
  roomId: null,
  isHost: false,
  isConnected: false,
  peerId: null,
  
  // Actions
  initGame: (mode, color = 'white') => {
    const game = new Chess();
    set({
      game,
      gameMode: mode,
      playerColor: color,
      isMyTurn: color === 'white',
      lastMove: null,
      gameStatus: mode === 'online' ? 'waiting' : 'playing',
      winner: null,
      currentScreen: 'game',
    });
  },
  
  makeMove: (from, to, promotion) => {
    const { game, playerColor, gameMode: _gameMode } = get();
    
    try {
      const move = game.move({ from, to, promotion });
      if (!move) return false;
      
      // Check game status
      let gameStatus: GameState['gameStatus'] = 'playing';
      let winner: PlayerColor | null = null;
      
      if (game.isGameOver()) {
        if (game.isCheckmate()) {
          gameStatus = 'checkmate';
          winner = game.turn() === 'w' ? 'black' : 'white';
        } else if (game.isDraw()) {
          gameStatus = 'draw';
        }
      }
      
      const isMyTurn = _gameMode === 'pass-and-play' 
        ? true 
        : (playerColor === 'white' ? game.turn() === 'w' : game.turn() === 'b');
      
      set({
        game,
        lastMove: { from, to },
        isMyTurn,
        gameStatus,
        winner,
      });
      
      return true;
    } catch {
      return false;
    }
  },
  
  resetGame: () => {
    const { playerColor } = get();
    const game = new Chess();
    set({
      game,
      lastMove: null,
      isMyTurn: playerColor === 'white',
      gameStatus: 'playing',
      winner: null,
    });
  },
  
  resignGame: () => {
    const { playerColor } = get();
    set({
      gameStatus: 'resigned',
      winner: playerColor === 'white' ? 'black' : 'white',
    });
  },
  
  setRoomId: (id) => set({ roomId: id }),
  setIsHost: (isHost) => set({ isHost }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setPeerId: (id) => set({ peerId: id }),
  setLastMove: (move) => set({ lastMove: move }),
  
  syncGameState: (fen, _moveHistory) => {
    const game = new Chess(fen);
    set({ game, lastMove: null });
  },
}));