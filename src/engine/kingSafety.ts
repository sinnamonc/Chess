import { Chess, type Square } from 'chess.js';
import type { KingSafetyAnalysis } from '../types';

const KING_SIDE_PAWN_SHIELD_W: Square[] = ['f2', 'g2', 'h2'];
const QUEEN_SIDE_PAWN_SHIELD_W: Square[] = ['a2', 'b2', 'c2'];
const KING_SIDE_PAWN_SHIELD_B: Square[] = ['f7', 'g7', 'h7'];
const QUEEN_SIDE_PAWN_SHIELD_B: Square[] = ['a7', 'b7', 'c7'];

function findKing(chess: Chess, color: 'w' | 'b'): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        const file = String.fromCharCode(97 + c);
        const rank = String(8 - r);
        return (file + rank) as Square;
      }
    }
  }
  return null;
}

function hasCastled(fen: string, color: 'w' | 'b'): boolean {
  // Heuristic: if king is on g1/c1 (white) or g8/c8 (black) and castling rights
  // are gone for that side, it likely castled
  const chess = new Chess(fen);
  const kingPos = findKing(chess, color);
  if (!kingPos) return false;

  if (color === 'w') {
    return kingPos === 'g1' || kingPos === 'c1';
  } else {
    return kingPos === 'g8' || kingPos === 'c8';
  }
}

function hasCastlingRights(fen: string, color: 'w' | 'b'): boolean {
  const parts = fen.split(' ');
  const castling = parts[2] || '-';
  if (color === 'w') {
    return castling.includes('K') || castling.includes('Q');
  }
  return castling.includes('k') || castling.includes('q');
}

function countPawnShield(chess: Chess, color: 'w' | 'b', side: 'king' | 'queen'): number {
  let shields: Square[];
  if (color === 'w') {
    shields = side === 'king' ? KING_SIDE_PAWN_SHIELD_W : QUEEN_SIDE_PAWN_SHIELD_W;
  } else {
    shields = side === 'king' ? KING_SIDE_PAWN_SHIELD_B : QUEEN_SIDE_PAWN_SHIELD_B;
  }

  let count = 0;
  for (const sq of shields) {
    const piece = chess.get(sq);
    if (piece && piece.type === 'p' && piece.color === color) {
      count++;
    }
  }
  return count;
}

function assessKingSafety(
  chess: Chess,
  color: 'w' | 'b',
  fen: string
): 'safe' | 'moderate' | 'exposed' | 'dangerous' {
  const kingPos = findKing(chess, color);
  if (!kingPos) return 'dangerous';

  const castled = hasCastled(fen, color);
  const file = kingPos.charCodeAt(0) - 97;
  const rank = parseInt(kingPos[1]);

  // King in center in the middlegame is exposed
  const isCenter = file >= 2 && file <= 5;
  const isBackRank = (color === 'w' && rank === 1) || (color === 'b' && rank === 8);

  if (castled) {
    // Check pawn shield
    const side = file >= 4 ? 'king' : 'queen';
    const shieldCount = countPawnShield(chess, color, side);
    if (shieldCount >= 3) return 'safe';
    if (shieldCount >= 2) return 'moderate';
    return 'exposed';
  }

  if (isCenter && !isBackRank) return 'dangerous';
  if (isCenter && isBackRank && hasCastlingRights(fen, color)) return 'moderate';
  if (isCenter && isBackRank) return 'exposed';

  return 'moderate';
}

export function analyzeKingSafety(fen: string): KingSafetyAnalysis {
  const chess = new Chess(fen);
  const whiteCastled = hasCastled(fen, 'w');
  const blackCastled = hasCastled(fen, 'b');
  const whiteKingSafety = assessKingSafety(chess, 'w', fen);
  const blackKingSafety = assessKingSafety(chess, 'b', fen);

  let summary = '';
  const details: string[] = [];

  // Describe white king
  if (whiteCastled) {
    if (whiteKingSafety === 'safe') {
      details.push("White's king is safely castled with a solid pawn shield.");
    } else if (whiteKingSafety === 'exposed') {
      details.push("White has castled but the pawn shield is weakened.");
    }
  } else {
    if (whiteKingSafety === 'dangerous') {
      details.push("White's king is stuck in the center — a risky situation!");
    } else if (whiteKingSafety === 'exposed') {
      details.push("White hasn't castled yet and the king may become a target.");
    }
  }

  // Describe black king
  if (blackCastled) {
    if (blackKingSafety === 'safe') {
      details.push("Black's king is safely castled with a solid pawn shield.");
    } else if (blackKingSafety === 'exposed') {
      details.push("Black has castled but the pawn shield is weakened.");
    }
  } else {
    if (blackKingSafety === 'dangerous') {
      details.push("Black's king is stuck in the center — a risky situation!");
    } else if (blackKingSafety === 'exposed') {
      details.push("Black hasn't castled yet and the king may become a target.");
    }
  }

  if (details.length === 0) {
    summary = 'Both kings are reasonably safe.';
  } else {
    summary = details.join(' ');
  }

  return {
    whiteCastled,
    blackCastled,
    whiteKingSafety,
    blackKingSafety,
    summary,
  };
}
