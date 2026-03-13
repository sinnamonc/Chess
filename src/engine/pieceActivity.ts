import { Chess, type Square } from 'chess.js';
import type { ActivityAnalysis } from '../types';

/**
 * Count total legal moves as a proxy for piece activity/mobility
 */
function countMobility(fen: string, color: 'w' | 'b'): number {
  // Modify FEN to set the desired side to move
  const parts = fen.split(' ');
  parts[1] = color;
  // Reset en passant and halfmove when switching sides (to avoid invalid positions)
  const modifiedFen = parts.join(' ');

  try {
    const chess = new Chess(modifiedFen);
    return chess.moves().length;
  } catch {
    return 0;
  }
}


/**
 * Detect pieces on strong central squares (d4, d5, e4, e5)
 */
function countCentralPieces(chess: Chess, color: 'w' | 'b'): number {
  const centralSquares: Square[] = ['d4', 'd5', 'e4', 'e5'];
  let count = 0;
  for (const sq of centralSquares) {
    const piece = chess.get(sq);
    if (piece && piece.color === color && piece.type !== 'p') {
      count++;
    }
  }
  return count;
}

/**
 * Detect rooks on open files
 */
function countRooksOnOpenFiles(chess: Chess, color: 'w' | 'b'): number {
  const board = chess.board();
  let count = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'r' && piece.color === color) {
        // Check if this file has no pawns
        let hasPawn = false;
        for (let row = 0; row < 8; row++) {
          const p = board[row][c];
          if (p && p.type === 'p') {
            hasPawn = true;
            break;
          }
        }
        if (!hasPawn) count++;
      }
    }
  }

  return count;
}

export function analyzeActivity(fen: string): ActivityAnalysis {
  const chess = new Chess(fen);
  const whiteMobility = countMobility(fen, 'w');
  const blackMobility = countMobility(fen, 'b');

  const whiteCentral = countCentralPieces(chess, 'w');
  const blackCentral = countCentralPieces(chess, 'b');
  const whiteOpenRooks = countRooksOnOpenFiles(chess, 'w');
  const blackOpenRooks = countRooksOnOpenFiles(chess, 'b');

  const observations: string[] = [];

  // Mobility comparison
  const mobDiff = whiteMobility - blackMobility;
  if (Math.abs(mobDiff) > 10) {
    const better = mobDiff > 0 ? 'White' : 'Black';
    observations.push(`${better}'s pieces are significantly more active.`);
  } else if (Math.abs(mobDiff) > 5) {
    const better = mobDiff > 0 ? 'White' : 'Black';
    observations.push(`${better}'s pieces are slightly more active.`);
  }

  // Central control
  if (whiteCentral > blackCentral && whiteCentral >= 2) {
    observations.push('White has strong central piece placement.');
  } else if (blackCentral > whiteCentral && blackCentral >= 2) {
    observations.push('Black has strong central piece placement.');
  }

  // Open file rooks
  if (whiteOpenRooks > 0) {
    observations.push(`White has a rook on an open file.`);
  }
  if (blackOpenRooks > 0) {
    observations.push(`Black has a rook on an open file.`);
  }

  const summary = observations.length > 0
    ? observations.join(' ')
    : 'Both sides have roughly equal piece activity.';

  return {
    whiteMobility,
    blackMobility,
    summary,
  };
}
