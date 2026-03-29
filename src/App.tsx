import { useGameStore } from './store/gameStore';
import GameModeSelect from './components/GameModeSelect';
import ChessBoard from './components/ChessBoard';
import ConnectionPanel from './components/ConnectionPanel';

function App() {
  const { currentScreen } = useGameStore();

  return (
    <div className="min-h-screen bg-chess-bg flex flex-col">
      {currentScreen === 'home' && <GameModeSelect />}
      {currentScreen === 'game' && <ChessBoard />}
      {currentScreen === 'connect' && <ConnectionPanel />}
    </div>
  );
}

export default App;