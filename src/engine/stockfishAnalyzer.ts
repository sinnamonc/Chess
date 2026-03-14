import { Chess } from 'chess.js';
import type { AnalyzedMove, EngineEvaluation, MoveQuality } from '../types';
import { getStockfishService, type EngineEval } from './stockfishService';

const SEARCH_DEPTH = 16;

/** Convert a UCI move (e.g. "e2e4") to SAN (e.g. "e4") for a given FEN */
function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

/** Convert raw engine eval to our EngineEvaluation type */
function toEngineEvaluation(raw: EngineEval, fen: string): EngineEvaluation {
  return {
    cp: raw.cp,
    mate: raw.mate,
    bestMoveSan: uciToSan(fen, raw.bestMove),
    bestMoveUci: raw.bestMove,
    depth: raw.depth,
  };
}

/**
 * Convert an eval to a single numeric score for comparison.
 * Mate scores are mapped to large centipawn values.
 * Always from white's perspective.
 */
function evalToScore(ev: EngineEvaluation): number {
  if (ev.mate !== null) {
    // Mate in N: use a large value, decreasing with distance
    return ev.mate > 0 ? 10000 - ev.mate : -10000 - ev.mate;
  }
  return ev.cp ?? 0;
}

/**
 * Classify move quality based on the centipawn loss.
 * cpLoss is always >= 0 (how much worse the played move is vs the best move).
 */
function classifyMoveQuality(cpLoss: number, isBestMove: boolean, move: AnalyzedMove): MoveQuality {
  // Brilliant: a sacrifice that is the best move (or very close)
  if (isBestMove && move.tags.includes('sacrifice')) {
    return 'brilliant';
  }

  if (cpLoss <= 10) return 'great';
  if (cpLoss <= 30) return 'good';
  if (cpLoss <= 80) return 'inaccuracy';
  if (cpLoss <= 200) return 'mistake';
  return 'blunder';
}

export interface AnalysisProgress {
  current: number;
  total: number;
  phase: 'heuristic' | 'engine';
}

/**
 * Run Stockfish analysis on all moves and enrich AnalyzedMove[] with engine data.
 * This mutates the moves array in place and calls onProgress for UI updates.
 */
export async function enrichWithStockfish(
  moves: AnalyzedMove[],
  startingFen: string,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<void> {
  const sf = getStockfishService();
  await sf.init();

  // We need evals for the starting position + each position after a move
  // That's (moves.length + 1) evaluations, but we can be smart:
  // Evaluate position BEFORE first move, then position AFTER each move.

  const total = moves.length + 1;
  let current = 0;

  // Evaluate starting position
  onProgress?.({ current: 0, total, phase: 'engine' });
  const startEval = await sf.evaluate(startingFen, SEARCH_DEPTH);
  const startEvaluation = toEngineEvaluation(startEval, startingFen);
  current++;
  onProgress?.({ current, total, phase: 'engine' });

  let prevEval = startEvaluation;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    // Evaluate position after this move
    const raw = await sf.evaluate(move.fen, SEARCH_DEPTH);
    const evaluation = toEngineEvaluation(raw, move.fen);

    move.engineEvalBefore = prevEval;
    move.engineEval = evaluation;

    // Calculate CP loss
    // The "before" eval tells us what the best move would score.
    // The "after" eval tells us what the played move actually scored.
    // We need to compare from the moving side's perspective.
    const scoreBefore = evalToScore(prevEval);
    const scoreAfter = evalToScore(evaluation);

    let cpLoss: number;
    if (move.color === 'w') {
      // White moved. Before: white's best = scoreBefore. After: scoreAfter.
      // If white played the best move, scoreAfter should be close to scoreBefore.
      // cpLoss = how much the position got worse for the side that moved.
      cpLoss = scoreBefore - scoreAfter;
    } else {
      // Black moved. A lower score (more negative) is better for black.
      cpLoss = scoreAfter - scoreBefore;
    }

    // Clamp to >= 0 (sometimes engine finds better move after due to horizon)
    cpLoss = Math.max(0, cpLoss);

    const isBestMove = prevEval.bestMoveUci === uciToUci(move);
    move.moveQuality = classifyMoveQuality(cpLoss, isBestMove, move);
    move.cpLoss = cpLoss;

    prevEval = evaluation;
    current++;
    onProgress?.({ current, total, phase: 'engine' });
  }
}

/**
 * Get the UCI representation of a move from an AnalyzedMove.
 * Derives it from fenBefore + san.
 */
function uciToUci(move: AnalyzedMove): string {
  try {
    const chess = new Chess(move.fenBefore);
    const result = chess.move(move.san);
    if (!result) return '';
    const promo = result.promotion ? result.promotion : '';
    return result.from + result.to + promo;
  } catch {
    return '';
  }
}
