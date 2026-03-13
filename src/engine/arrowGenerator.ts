import type { Arrow, MoveTag, PositionAnalysis } from '../types';
import type { ParsedMove } from '../utils/pgnParser';
import type { Square } from 'chess.js';
import { detectThreats } from './tactics';

interface ArrowResult {
  arrows: Arrow[];
  highlights: Square[];
}

/**
 * Generate visual annotations (arrows and highlights) for a move
 */
export function generateArrows(
  move: ParsedMove,
  _analysisBefore: PositionAnalysis,
  analysisAfter: PositionAnalysis,
  tags: MoveTag[]
): ArrowResult {
  const arrows: Arrow[] = [];
  const highlights: Square[] = [];

  // Always show the move itself
  arrows.push({
    from: move.from as Square,
    to: move.to as Square,
    color: getMoveColor(tags),
  });

  // Highlight the destination square
  highlights.push(move.to as Square);

  // For captures, highlight the captured square in red
  if (move.captured) {
    // Square is already the destination for captures
  }

  // For checks, highlight the king's square
  if (move.isCheck || move.isCheckmate) {
    const kingSquare = findKingSquare(move.fen, move.color === 'w' ? 'b' : 'w');
    if (kingSquare) {
      highlights.push(kingSquare);
    }
  }

  // Show threats after the move (what the moving side is now threatening)
  const threats = detectThreats(move.fen);
  for (const threat of threats.slice(0, 2)) {
    if (threat.from !== threat.to) {
      // Don't duplicate the main move arrow
      if (threat.from !== move.from || threat.to !== move.to) {
        arrows.push({
          from: threat.from,
          to: threat.to,
          color: 'red',
        });
      }
    }
  }

  // For castling, also show the rook's movement
  if (move.isCastling) {
    if (move.san === 'O-O') {
      if (move.color === 'w') {
        arrows.push({ from: 'h1', to: 'f1', color: 'blue' });
      } else {
        arrows.push({ from: 'h8', to: 'f8', color: 'blue' });
      }
    } else {
      if (move.color === 'w') {
        arrows.push({ from: 'a1', to: 'd1', color: 'blue' });
      } else {
        arrows.push({ from: 'a8', to: 'd8', color: 'blue' });
      }
    }
  }

  // Highlight passed pawns
  if (analysisAfter.pawns.whitePassed.length > 0) {
    for (const sq of analysisAfter.pawns.whitePassed) {
      highlights.push(sq);
    }
  }
  if (analysisAfter.pawns.blackPassed.length > 0) {
    for (const sq of analysisAfter.pawns.blackPassed) {
      highlights.push(sq);
    }
  }

  // Limit arrows to avoid clutter
  return {
    arrows: arrows.slice(0, 5),
    highlights: [...new Set(highlights)].slice(0, 6),
  };
}

/**
 * Choose arrow color based on move tags
 */
function getMoveColor(tags: MoveTag[]): 'green' | 'red' | 'yellow' | 'blue' {
  if (tags.includes('sacrifice')) return 'yellow';
  if (tags.includes('checkmate')) return 'red';
  if (tags.includes('check')) return 'red';
  if (tags.includes('capture')) return 'red';
  if (tags.includes('castles')) return 'blue';
  if (tags.includes('developing')) return 'green';
  return 'green';
}

/**
 * Find the king's square from a FEN
 */
function findKingSquare(fen: string, color: 'w' | 'b'): Square | null {
  const board = fen.split(' ')[0];
  const rows = board.split('/');
  const kingChar = color === 'w' ? 'K' : 'k';

  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        col += parseInt(ch);
      } else {
        if (ch === kingChar) {
          return (String.fromCharCode(97 + col) + String(8 - r)) as Square;
        }
        col++;
      }
    }
  }
  return null;
}
