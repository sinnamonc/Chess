import { Chess } from 'chess.js';
import type { AnalyzedMove, EngineEvaluation, EngineLine, MoveQuality } from '../types';
import { getStockfishPool } from './stockfishPool';
import type { MultiPVResult } from './stockfishService';

const QUICK_DEPTH = 10;
const FULL_DEPTH = 16;
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

function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Normalize MultiPV results to white's perspective */
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

function evalToScore(ev: EngineEvaluation): number {
  if (ev.mate !== null) {
    return ev.mate > 0 ? 10000 - ev.mate : -10000 - ev.mate;
  }
  return ev.cp ?? 0;
}

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

function uciToUci(move: AnalyzedMove): string {
  try {
    const chess = new Chess(move.fenBefore);
    const result = chess.move(move.san);
    if (!result) return '';
    return result.from + result.to + (result.promotion || '');
  } catch {
    return '';
  }
}

export interface MoveEvalResult {
  engineLines: EngineLine[];
  engineEval: EngineEvaluation;
  engineEvalBefore: EngineEvaluation;
  moveQuality: MoveQuality;
  cpLoss: number;
  depth: number;
}

/**
 * Evaluate a single move on demand. Returns engine lines + eval + move quality.
 * Uses the worker pool for parallelism and caching.
 *
 * @param move - The move to evaluate
 * @param depth - Search depth
 * @param priority - Lower = higher priority (0 for current, 10 for prefetch)
 */
export async function evaluateMove(
  move: AnalyzedMove,
  depth: number = FULL_DEPTH,
  priority: number = 0,
): Promise<MoveEvalResult> {
  const pool = getStockfishPool();

  // Two evaluations in parallel:
  // 1. Position BEFORE move — Single PV (just need eval for cp loss calculation)
  // 2. Position AFTER move — MultiPV (for engine lines showing best responses)
  const [beforeResults, afterResults] = await Promise.all([
    pool.evaluate(move.fenBefore, depth, 1, priority),
    pool.evaluate(move.fen, depth, NUM_LINES, priority),
  ]);

  const beforeLines = toEngineLines(beforeResults, move.fenBefore);
  const evalBefore = toEngineEvaluation(beforeLines);
  const engineLines = toEngineLines(afterResults, move.fen);
  const evalAfter = toEngineEvaluation(engineLines);

  // CP loss calculation
  const scoreBefore = evalToScore(evalBefore);
  const scoreAfter = evalToScore(evalAfter);
  let cpLoss = move.color === 'w'
    ? scoreBefore - scoreAfter
    : scoreAfter - scoreBefore;
  cpLoss = Math.max(0, cpLoss);

  const isBestMove = evalBefore.bestMoveUci === uciToUci(move);
  const moveQuality = classifyMoveQuality(cpLoss, isBestMove, move);

  return {
    engineLines,
    engineEval: evalAfter,
    engineEvalBefore: evalBefore,
    moveQuality,
    cpLoss,
    depth,
  };
}

/**
 * Evaluate a move with progressive deepening:
 * 1. Quick pass at depth 10 → call onQuick immediately
 * 2. Full pass at depth 16 → call onFull when done
 *
 * Returns an abort function to cancel the full-depth pass.
 */
export function evaluateMoveProgressive(
  move: AnalyzedMove,
  onQuick: (result: MoveEvalResult) => void,
  onFull: (result: MoveEvalResult) => void,
  priority: number = 0,
): () => void {
  let aborted = false;

  (async () => {
    try {
      // Check if we already have full-depth cached
      const pool = getStockfishPool();
      const cachedBefore = pool.getCached(move.fenBefore, FULL_DEPTH, 1);
      const cachedAfter = pool.getCached(move.fen, FULL_DEPTH, NUM_LINES);

      if (cachedBefore && cachedAfter) {
        // Already have full-depth results — skip quick pass
        const result = await evaluateMove(move, FULL_DEPTH, priority);
        if (!aborted) onFull(result);
        return;
      }

      // Quick pass
      const quickResult = await evaluateMove(move, QUICK_DEPTH, priority);
      if (aborted) return;
      onQuick(quickResult);

      // Full pass
      const fullResult = await evaluateMove(move, FULL_DEPTH, priority + 1);
      if (aborted) return;
      onFull(fullResult);
    } catch {
      // Swallow errors from aborted/cleared queue
    }
  })();

  return () => { aborted = true; };
}

/**
 * Prefetch evaluations for nearby moves (non-blocking, low priority).
 */
export function prefetchMoves(moves: AnalyzedMove[], centerIndex: number): void {
  const pool = getStockfishPool();
  const indicesToPrefetch = [centerIndex + 1, centerIndex + 2, centerIndex - 1];

  for (const idx of indicesToPrefetch) {
    if (idx < 0 || idx >= moves.length) continue;
    const m = moves[idx];

    // Only prefetch if not already cached at full depth
    if (!pool.getCached(m.fenBefore, FULL_DEPTH, 1)) {
      pool.evaluate(m.fenBefore, FULL_DEPTH, 1, 10).catch(() => {});
    }
    if (!pool.getCached(m.fen, FULL_DEPTH, NUM_LINES)) {
      pool.evaluate(m.fen, FULL_DEPTH, NUM_LINES, 10).catch(() => {});
    }
  }
}

// Re-export for backwards compat with progress type
export interface AnalysisProgress {
  current: number;
  total: number;
  phase: 'heuristic' | 'engine';
}
