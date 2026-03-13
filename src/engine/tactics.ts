import { Chess, type Square } from 'chess.js';

export interface ThreatInfo {
  description: string;
  from: Square;
  to: Square;
}

/**
 * Detect basic tactical themes in the position
 */
export function detectThreats(fen: string): ThreatInfo[] {
  const chess = new Chess(fen);
  const threats: ThreatInfo[] = [];
  const sideToMove = chess.turn();
  const opponent = sideToMove === 'w' ? 'b' : 'w';
  const sideName = sideToMove === 'w' ? 'White' : 'Black';

  const moves = chess.moves({ verbose: true });

  // Detect capturing moves that win material
  for (const move of moves) {
    if (move.captured) {
      const attackerValue = pieceValue(move.piece);
      const targetValue = pieceValue(move.captured);

      if (targetValue >= attackerValue) {
        const pieceName = pieceLongName(move.captured);
        threats.push({
          description: `${sideName} can capture the ${pieceName} on ${move.to}.`,
          from: move.from,
          to: move.to,
        });
      }
    }
  }

  // Detect checks
  for (const move of moves) {
    if (move.san.includes('+')) {
      threats.push({
        description: `${sideName} can give check with ${pieceLongName(move.piece)} to ${move.to}.`,
        from: move.from,
        to: move.to,
      });
    }
    if (move.san.includes('#')) {
      threats.push({
        description: `${sideName} has checkmate available!`,
        from: move.from,
        to: move.to,
      });
    }
  }

  // Detect undefended opponent pieces that are attacked
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === opponent && piece.type !== 'k' && piece.type !== 'p') {
        const sq = (String.fromCharCode(97 + c) + String(8 - r)) as Square;
        if (chess.isAttacked(sq, sideToMove) && !chess.isAttacked(sq, opponent)) {
          threats.push({
            description: `The ${pieceLongName(piece.type)} on ${sq} is undefended and under attack!`,
            from: sq,
            to: sq,
          });
        }
      }
    }
  }

  // Limit to most important threats
  return threats.slice(0, 3);
}

/**
 * Detect if the current move creates a fork (one piece attacking two+ valuable pieces)
 */
export function detectFork(fenAfter: string, _movedTo: Square, piece: string): string | null {
  const chess = new Chess(fenAfter);
  const color = chess.turn() === 'w' ? 'b' : 'w'; // piece that just moved
  const opponent = color === 'w' ? 'b' : 'w';
  const board = chess.board();

  if (piece === 'p' || piece === 'k') return null;

  let attackedPieces: { type: string; square: Square }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const target = board[r][c];
      if (target && target.color === opponent && (target.type === 'q' || target.type === 'r' || target.type === 'k')) {
        const sq = (String.fromCharCode(97 + c) + String(8 - r)) as Square;
        if (chess.isAttacked(sq, color)) {
          attackedPieces.push({ type: target.type, square: sq });
        }
      }
    }
  }

  if (attackedPieces.length >= 2) {
    const names = attackedPieces.map(p => pieceLongName(p.type)).join(' and ');
    return `This ${pieceLongName(piece)} is forking the ${names}!`;
  }

  return null;
}

function pieceValue(piece: string): number {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  return values[piece] || 0;
}

function pieceLongName(piece: string): string {
  const names: Record<string, string> = {
    p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
  };
  return names[piece] || piece;
}
