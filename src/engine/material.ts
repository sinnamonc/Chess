import { Chess } from 'chess.js';
import type { MaterialAnalysis, MaterialCount } from '../types';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
};

function countMaterial(chess: Chess, color: 'w' | 'b'): MaterialCount {
  const board = chess.board();
  const count: MaterialCount = {
    pawns: 0,
    knights: 0,
    bishops: 0,
    rooks: 0,
    queens: 0,
    total: 0,
  };

  for (const row of board) {
    for (const square of row) {
      if (square && square.color === color) {
        switch (square.type) {
          case 'p': count.pawns++; break;
          case 'n': count.knights++; break;
          case 'b': count.bishops++; break;
          case 'r': count.rooks++; break;
          case 'q': count.queens++; break;
        }
      }
    }
  }

  count.total =
    count.pawns * 1 +
    count.knights * 3 +
    count.bishops * 3 +
    count.rooks * 5 +
    count.queens * 9;

  return count;
}

function describeMaterialDifference(white: MaterialCount, black: MaterialCount): { summary: string; detail?: string } {
  const diff = white.total - black.total;

  if (diff === 0) {
    if (white.bishops === 2 && black.bishops < 2) {
      return { summary: 'Material is equal', detail: 'White has the bishop pair, a small long-term advantage.' };
    }
    if (black.bishops === 2 && white.bishops < 2) {
      return { summary: 'Material is equal', detail: 'Black has the bishop pair, a small long-term advantage.' };
    }
    return { summary: 'Material is equal.' };
  }

  const ahead = diff > 0 ? 'White' : 'Black';
  const absDiff = Math.abs(diff);

  // Figure out what's different
  const pDiff = white.pawns - black.pawns;
  const nDiff = white.knights - black.knights;
  const bDiff = white.bishops - black.bishops;
  const rDiff = white.rooks - black.rooks;
  const qDiff = white.queens - black.queens;

  const pieces: string[] = [];
  const addDiff = (count: number, name: string) => {
    const abs = Math.abs(count);
    if (abs > 0 && ((count > 0 && diff > 0) || (count < 0 && diff < 0))) {
      pieces.push(abs === 1 ? `a ${name}` : `${abs} ${name}s`);
    }
  };

  addDiff(diff > 0 ? qDiff : -qDiff, 'queen');
  addDiff(diff > 0 ? rDiff : -rDiff, 'rook');
  addDiff(diff > 0 ? bDiff : -bDiff, 'bishop');
  addDiff(diff > 0 ? nDiff : -nDiff, 'knight');
  addDiff(diff > 0 ? pDiff : -pDiff, 'pawn');

  let summary: string;
  if (pieces.length > 0) {
    summary = `${ahead} is up ${pieces.join(' and ')}.`;
  } else if (absDiff <= 1) {
    summary = `${ahead} has a slight material edge.`;
  } else if (absDiff <= 3) {
    summary = `${ahead} is up a minor piece worth of material.`;
  } else {
    summary = `${ahead} has a significant material advantage.`;
  }

  return { summary };
}

export function analyzeMaterial(fen: string): MaterialAnalysis {
  const chess = new Chess(fen);
  const white = countMaterial(chess, 'w');
  const black = countMaterial(chess, 'b');
  const balance = white.total - black.total;
  const { summary, detail } = describeMaterialDifference(white, black);

  return { white, black, balance, summary, detail };
}

/**
 * Detect if a move was a sacrifice (gave up higher-value material without immediate recapture)
 */
export function isSacrifice(
  fenBefore: string,
  fenAfter: string,
  pieceMoved: string,
  capturedPiece?: string
): boolean {
  if (!capturedPiece) {
    // Check if the piece moved to a square where it can be captured by a lower-value piece
    const before = analyzeMaterial(fenBefore);
    const after = analyzeMaterial(fenAfter);
    const matSwing = Math.abs(before.balance - after.balance);
    // If material changed significantly and the moving side lost material
    return matSwing >= 2;
  }

  // Captured something — check if it's an uneven trade
  const movedValue = PIECE_VALUES[pieceMoved] || 0;
  const capturedValue = PIECE_VALUES[capturedPiece] || 0;
  return movedValue > capturedValue + 1;
}

export function getPieceName(piece: string): string {
  return PIECE_NAMES[piece] || piece;
}

export function getPieceValue(piece: string): number {
  return PIECE_VALUES[piece] || 0;
}
