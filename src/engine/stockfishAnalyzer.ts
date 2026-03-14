import { Chess } from 'chess.js';
import type { AnalyzedMove, EngineEvaluation, EngineLine, MoveQuality } from '../types';
import { getStockfishService, type MultiPVResult } from './stockfishService';

const SEARCH_DEPTH = 16;
const NUM_LINES = 3;

/** Convert a sequence of UCI moves to SAN, playing them on the board */
function uciSequenceToSan(fen: string, uciMoves: string[]): string[] {
  const sanMoves: string[] = [];
  try {
    const chess = new Chess(fen);
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = chess.move({ from, to, promotion });
      if (!move) break;
      sanMoves.push(move.san);
    }
  } catch {
    // Return what we have so far
  }
  return sanMoves;
}

/** Determine side to move from a FEN string */
function sideToMove(fen: string): 'w' | 'b' {
  const parts = fen.split(' ');
  return (parts[1] === 'b' ? 'b' : 'w');
}

/**
 * Convert raw MultiPV results to EngineLine[], normalizing scores to white's perspective.
 */
function toEngineLines(results: MultiPVResult[], fen: string): EngineLine[] {
  const flip = sideToMove(fen) === 'b';
  return results.map((r) => ({
    rank: r.rank,
    cp: r.cp !== null ? (flip ? -r.cp : r.cp) : null,
    mate: r.mate !== null ? (flip ? -r.mate : r.mate) : null,
    pvUci: r.pv,
    pvSan: uciSequenceToSan(fen, r.pv),
    depth: r.depth,
  }));
}

/**
 * Convert raw engine eval to our EngineEvaluation type.
 * Normalizes the score to always be from WHITE's perspective.
 */
function toEngineEvaluation(lines: EngineLine[]): EngineEvaluation {
  const best = lines[0];
  if (!best) {
    return { cp: 0, mate: null, bestMoveSan: '', bestMoveUci: '', depth: 0 };
  }
  return {
    cp: best.cp,
    mate: best.mate,
    bestMoveSan: best.pvSan[0] || '',
    bestMoveUci: best.pvUci[0] || '',
    depth: best.depth,
  };
}

/**
 * Convert an eval to a single numeric score for comparison.
 */
function evalToScore(ev: EngineEvaluation): number {
  if (ev.mate !== null) {
    return ev.mate > 0 ? 10000 - ev.mate : -10000 - ev.mate;
  }
  return ev.cp ?? 0;
}

/**
 * Classify move quality based on the centipawn loss.
 */
function classifyMoveQuality(cpLoss: number, isBestMove: boolean, move: AnalyzedMove): MoveQuality {
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
 * Run Stockfish MultiPV analysis on all moves and enrich AnalyzedMove[] with engine data.
 */
export async function enrichWithStockfish(
  moves: AnalyzedMove[],
  startingFen: string,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<void> {
  const sf = getStockfishService();
  await sf.init();

  const total = moves.length + 1;
  let current = 0;

  // Evaluate starting position
  onProgress?.({ current: 0, total, phase: 'engine' });
  const startResults = await sf.evaluateMultiPV(startingFen, SEARCH_DEPTH, NUM_LINES);
  const startLines = toEngineLines(startResults, startingFen);
  const startEvaluation = toEngineEvaluation(startLines);
  current++;
  onProgress?.({ current, total, phase: 'engine' });

  let prevEval = startEvaluation;
  let prevLines = startLines;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    // The engine lines for this move come from the position BEFORE the move
    // (what the engine thinks should be considered in the position the player faced)
    move.engineLines = prevLines;

    // Evaluate position after this move
    const results = await sf.evaluateMultiPV(move.fen, SEARCH_DEPTH, NUM_LINES);
    const lines = toEngineLines(results, move.fen);
    const evaluation = toEngineEvaluation(lines);

    move.engineEvalBefore = prevEval;
    move.engineEval = evaluation;

    // Calculate CP loss
    const scoreBefore = evalToScore(prevEval);
    const scoreAfter = evalToScore(evaluation);

    let cpLoss: number;
    if (move.color === 'w') {
      cpLoss = scoreBefore - scoreAfter;
    } else {
      cpLoss = scoreAfter - scoreBefore;
    }
    cpLoss = Math.max(0, cpLoss);

    const isBestMove = prevEval.bestMoveUci === uciToUci(move);
    move.moveQuality = classifyMoveQuality(cpLoss, isBestMove, move);
    move.cpLoss = cpLoss;

    prevEval = evaluation;
    prevLines = lines;
    current++;
    onProgress?.({ current, total, phase: 'engine' });
  }

  // Reset MultiPV to 1 so subsequent single evaluations aren't affected
  // (not strictly necessary with our singleton, but good hygiene)
}

/**
 * Get the UCI representation of a move from an AnalyzedMove.
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
