import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { useChessEngine, formatEvaluation } from '../hooks/useChessEngine';

interface AnalysisPanelProps {
  onClose: () => void;
}

export default function AnalysisPanel({ onClose }: AnalysisPanelProps) {
  const { game, engineEnabled, setEngineEnabled } = useGameStore();
  const { isAnalyzing, evaluation, startAnalysis, stopAnalysis } = useChessEngine();
  
  const position = game.fen();

  // Calculate eval bar width (0-100%)
  const evalBarPercent = useMemo(() => {
    if (!evaluation) return 50;
    
    if (evaluation.mate !== null) {
      return evaluation.mate > 0 ? 100 : 0;
    }
    
    if (evaluation.score !== null) {
      // Convert centipawns to percentage (100cp = 1 pawn advantage)
      // Use sigmoid-like function for smooth bar
      const pawns = evaluation.score / 100;
      const percent = 50 + (pawns * 10); // Each pawn = 10%
      return Math.max(5, Math.min(95, percent));
    }
    
    return 50;
  }, [evaluation]);

  const handleToggleEngine = () => {
    if (engineEnabled) {
      stopAnalysis();
      setEngineEnabled(false);
    } else {
      setEngineEnabled(true);
      startAnalysis(position);
    }
  };

  const evalText = useMemo(() => {
    if (!evaluation) return '0.0';
    
    if (evaluation.mate !== null) {
      return `M${Math.abs(evaluation.mate)}`;
    }
    
    if (evaluation.score !== null) {
      const pawns = evaluation.score / 100;
      const sign = pawns >= 0 ? '+' : '';
      return `${sign}${pawns.toFixed(1)}`;
    }
    
    return '0.0';
  }, [evaluation]);

  const evalColor = useMemo(() => {
    if (!evaluation) return 'text-chess-text';
    
    if (evaluation.mate !== null) {
      return evaluation.mate > 0 ? 'text-chess-accent' : 'text-red-400';
    }
    
    if (evaluation.score !== null) {
      if (evaluation.score > 50) return 'text-chess-accent';
      if (evaluation.score < -50) return 'text-red-400';
    }
    
    return 'text-chess-text';
  }, [evaluation]);

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
          <h2 className="text-lg font-semibold text-chess-text">Analysis</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleEngine}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                engineEnabled 
                  ? 'bg-chess-accent text-white' 
                  : 'bg-chess-bg text-chess-text-muted hover:text-chess-text'
              }`}
            >
              {isAnalyzing ? '⏳ Analyzing...' : '🔍 Engine'}
            </button>
            <button 
              onClick={onClose}
              className="text-chess-text-muted hover:text-chess-text"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!engineEnabled ? (
            <div className="text-center py-8">
              <p className="text-chess-text-muted mb-4">Engine is disabled</p>
              <button
                onClick={handleToggleEngine}
                className="btn btn-primary"
              >
                Enable Engine
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Evaluation Bar */}
              <div className="bg-chess-bg rounded-lg p-4">
                <div className="flex items-center gap-4">
                  {/* Bar */}
                  <div className="flex-1">
                    <div className="h-8 bg-gray-700 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-white transition-all duration-500"
                        style={{ width: `${evalBarPercent}%` }}
                      />
                      <div 
                        className="bg-gray-900 transition-all duration-500"
                        style={{ width: `${100 - evalBarPercent}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Score */}
                  <div className={`text-2xl font-mono font-bold min-w-[60px] text-right ${evalColor}`}>
                    {evalText}
                  </div>
                </div>
                
                {/* Status text */}
                <div className="mt-2 text-sm text-chess-text-muted text-center">
                  {evaluation?.mate !== null 
                    ? (evaluation?.mate ?? 0) > 0 ? 'White mates' : 'Black mates'
                    : Math.abs((evaluation?.score ?? 0) / 100) < 0.3 
                      ? 'Equal position' 
                      : (evaluation?.score ?? 0) > 0 
                        ? 'White is better' 
                        : 'Black is better'
                  }
                </div>
              </div>

              {/* Best Move */}
              {evaluation?.bestMove && (
                <div className="bg-chess-bg rounded-lg p-4">
                  <h3 className="text-sm text-chess-text-muted mb-2">Best Move</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-bold text-chess-accent">
                      {evaluation.bestMove}
                    </span>
                    <span className="text-sm text-chess-text-muted">
                      Depth {evaluation.depth}
                    </span>
                  </div>
                </div>
              )}

              {/* Principal Variation */}
              {evaluation?.bestLine && evaluation.bestLine.length > 0 && (
                <div className="bg-chess-bg rounded-lg p-4">
                  <h3 className="text-sm text-chess-text-muted mb-2">Best Line</h3>
                  <div className="flex flex-wrap gap-2">
                    {evaluation.bestLine.slice(0, 8).map((move, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-chess-panel rounded text-sm font-mono text-chess-text"
                      >
                        {index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ''} {move}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isAnalyzing && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-chess-text-muted">
                    <div className="animate-spin">⏳</div>
                    <span>Analyzing position...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}