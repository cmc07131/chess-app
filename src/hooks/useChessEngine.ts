import { useState, useCallback, useRef, useEffect } from 'react';

interface EngineEvaluation {
  score: number | null; // Centipawns (positive = white advantage)
  mate: number | null; // Mate in X moves
  bestMove: string | null;
  bestLine: string[];
  depth: number;
  turn: 'w' | 'b';
  topMoves?: { move: string; score: number | null; mate: number | null }[];
}

interface UseChessEngineReturn {
  isAnalyzing: boolean;
  evaluation: EngineEvaluation | null;
  startAnalysis: (fen: string, depth?: number, turn?: 'w' | 'b') => void;
  stopAnalysis: () => void;
  toggleAnalysis: () => void;
}

export function useChessEngine(): UseChessEngineReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const currentFenRef = useRef<string>('');
  const currentTurnRef = useRef<'w' | 'b'>('w');
  const bestLineRef = useRef<string[]>([]);
  const bestScoreRef = useRef<{ type: 'cp' | 'mate'; value: number } | null>(null);
  const bestDepthRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const initWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    // Create a new worker with Stockfish
    const worker = new Worker('/stockfish.js');
    
    worker.onmessage = (event) => {
      const line = event.data;
      
      if (typeof line !== 'string') return;
      
      // Parse info lines for score and pv
      if (line.startsWith('info depth')) {
        const depthMatch = line.match(/depth\s+(\d+)/);
        const scoreCpMatch = line.match(/score\s+cp\s+(-?\d+)/);
        const scoreMateMatch = line.match(/score\s+mate\s+(-?\d+)/);
        const pvMatch = line.match(/pv\s+(.+?)(?:\s+|$)/);
        
        if (depthMatch) {
          const depth = parseInt(depthMatch[1]);
          
          // Only update if this depth is better than what we have
          if (depth >= bestDepthRef.current) {
            bestDepthRef.current = depth;
            
            // Extract score
            if (scoreCpMatch) {
              bestScoreRef.current = { type: 'cp', value: parseInt(scoreCpMatch[1]) };
            } else if (scoreMateMatch) {
              bestScoreRef.current = { type: 'mate', value: parseInt(scoreMateMatch[1]) };
            }
            
            // Extract principal variation
            if (pvMatch) {
              bestLineRef.current = pvMatch[1].split(' ').filter(m => m.length >= 4);
            }
            
            // Update evaluation with current best info
            setEvaluation({
              score: bestScoreRef.current?.type === 'cp' ? bestScoreRef.current.value : null,
              mate: bestScoreRef.current?.type === 'mate' ? bestScoreRef.current.value : null,
              bestMove: null, // Will be set from bestmove line
              bestLine: bestLineRef.current.slice(0, 6),
              depth: depth,
              turn: currentTurnRef.current,
            });
          }
        }
      }
      
      // Parse bestmove line
      if (line.startsWith('bestmove')) {
        const bestMoveMatch = line.match(/bestmove\s+(\w+)/);
        if (bestMoveMatch) {
          const bestMove = bestMoveMatch[1];
          
          // Final update with best move
          setEvaluation(prev => prev ? {
            ...prev,
            bestMove: bestMove,
          } : {
            score: bestScoreRef.current?.type === 'cp' ? bestScoreRef.current.value : null,
            mate: bestScoreRef.current?.type === 'mate' ? bestScoreRef.current.value : null,
            bestMove: bestMove,
            bestLine: bestLineRef.current.slice(0, 6),
            depth: bestDepthRef.current,
            turn: currentTurnRef.current,
          });
          
          setIsAnalyzing(false);
        }
      }
    };

    worker.onerror = (error) => {
      console.error('Stockfish worker error:', error);
      setIsAnalyzing(false);
    };

    worker.postMessage('uci');
    worker.postMessage('isready');
    
    workerRef.current = worker;
    return worker;
  }, []);

  const startAnalysis = useCallback((fen: string, depth: number = 18, turn: 'w' | 'b' = 'w') => {
    currentFenRef.current = fen;
    currentTurnRef.current = turn;
    setIsAnalyzing(true);
    setEvaluation(null);
    bestLineRef.current = [];
    bestScoreRef.current = null;
    bestDepthRef.current = 0;

    const worker = initWorker();
    
    // Wait for UCI to be ready, then start analysis
    setTimeout(() => {
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    }, 200);
  }, [initWorker]);

  const stopAnalysis = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop');
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsAnalyzing(false);
  }, []);

  const toggleAnalysis = useCallback(() => {
    if (isAnalyzing) {
      stopAnalysis();
    } else if (currentFenRef.current) {
      startAnalysis(currentFenRef.current);
    }
  }, [isAnalyzing, startAnalysis, stopAnalysis]);

  return {
    isAnalyzing,
    evaluation,
    startAnalysis,
    stopAnalysis,
    toggleAnalysis,
  };
}

// Helper to format evaluation
export function formatEvaluation(eval_: EngineEvaluation | null): string {
  if (!eval_) return '0.0';
  
  if (eval_.mate !== null) {
    return eval_.mate > 0 ? `M${eval_.mate}` : `M${Math.abs(eval_.mate)}`;
  }
  
  if (eval_.score !== null) {
    const pawns = eval_.score / 100;
    const sign = pawns >= 0 ? '+' : '';
    return `${sign}${pawns.toFixed(1)}`;
  }
  
  return '0.0';
}