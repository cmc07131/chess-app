import { useGameStore } from '../store/gameStore';

export default function GameModeSelect() {
  const { initGame, setCurrentScreen } = useGameStore();

  const handlePassAndPlay = () => {
    initGame('pass-and-play', 'white');
  };

  const handleOnlinePlay = () => {
    setCurrentScreen('connect');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">♔</div>
        <h1 className="text-4xl font-bold text-chess-text mb-2">Chess</h1>
        <p className="text-chess-text-muted">Play with friends offline</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={handlePassAndPlay}
          className="btn btn-primary w-full flex items-center justify-center gap-3"
        >
          <span className="text-2xl">👥</span>
          <div className="text-left">
            <div className="font-semibold">Pass & Play</div>
            <div className="text-sm opacity-80">Share one device</div>
          </div>
        </button>

        <button
          onClick={handleOnlinePlay}
          className="btn btn-secondary w-full flex items-center justify-center gap-3"
        >
          <span className="text-2xl">📡</span>
          <div className="text-left">
            <div className="font-semibold">Play with Friend</div>
            <div className="text-sm opacity-80">Connect via local network</div>
          </div>
        </button>
      </div>

      <div className="mt-12 text-center text-chess-text-muted text-sm">
        <p>No internet required</p>
        <p className="mt-1">Works on airplane mode ✓</p>
      </div>
    </div>
  );
}