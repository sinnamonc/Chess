import { Chess, type Square } from 'chess.js';
import type { PositionAnalysis, EngineLine } from '../types';

export interface StrategicIdea {
  /** Short title, e.g. "Kingside Attack" */
  title: string;
  /** One-sentence explanation */
  description: string;
  /** Squares to highlight on the board */
  squares: Square[];
  /** Arrows to show (from → to) */
  arrows: { from: Square; to: Square }[];
  /** Priority for sorting (higher = more important) */
  priority: number;
}

/**
 * Detect long-term strategic ideas by combining heuristic position analysis
 * with the engine's principal variation.
 */
export function detectStrategicIdeas(
  fen: string,
  analysis: PositionAnalysis,
  engineLines?: EngineLine[],
): StrategicIdea[] {
  const ideas: StrategicIdea[] = [];
  const chess = new Chess(fen);
  const sideToMove = chess.turn();
  const board = chess.board();

  // --- Passed pawn advancement ---
  const friendlyPassed = sideToMove === 'w' ? analysis.pawns.whitePassed : analysis.pawns.blackPassed;
  const enemyPassed = sideToMove === 'w' ? analysis.pawns.blackPassed : analysis.pawns.whitePassed;

  if (friendlyPassed.length > 0) {
    const promotionRank = sideToMove === 'w' ? '8' : '1';
    const arrows = friendlyPassed.map((sq) => ({
      from: sq as Square,
      to: (sq[0] + promotionRank) as Square,
    }));
    ideas.push({
      title: 'Push Passed Pawn',
      description: `${sideToMove === 'w' ? 'White' : 'Black'} should advance the passed pawn${friendlyPassed.length > 1 ? 's' : ''} on ${friendlyPassed.join(', ')}.`,
      squares: friendlyPassed as Square[],
      arrows,
      priority: 8,
    });
  }

  if (enemyPassed.length > 0) {
    ideas.push({
      title: 'Blockade Passed Pawn',
      description: `${sideToMove === 'w' ? 'White' : 'Black'} should blockade the enemy passed pawn${enemyPassed.length > 1 ? 's' : ''} on ${enemyPassed.join(', ')}.`,
      squares: enemyPassed as Square[],
      arrows: [],
      priority: 6,
    });
  }

  // --- Kingside attack (exposed enemy king) ---
  const enemyKingSafety = sideToMove === 'w' ? analysis.kingSafety.blackKingSafety : analysis.kingSafety.whiteKingSafety;
  if (enemyKingSafety === 'exposed' || enemyKingSafety === 'dangerous') {
    const kingSquare = findKing(board, sideToMove === 'w' ? 'b' : 'w');
    const attackSquares = kingSquare ? getAdjacentSquares(kingSquare) : [];
    ideas.push({
      title: 'Attack the King',
      description: `The enemy king is ${enemyKingSafety}. Direct pieces toward the king and look for tactical breaks.`,
      squares: kingSquare ? [kingSquare, ...attackSquares.slice(0, 3)] : [],
      arrows: kingSquare ? findPiecesAimingAt(chess, sideToMove, attackSquares).slice(0, 3) : [],
      priority: 9,
    });
  }

  // --- Defend the king ---
  const ownKingSafety = sideToMove === 'w' ? analysis.kingSafety.whiteKingSafety : analysis.kingSafety.blackKingSafety;
  if (ownKingSafety === 'exposed' || ownKingSafety === 'dangerous') {
    const kingSquare = findKing(board, sideToMove);
    ideas.push({
      title: 'Shore Up King Safety',
      description: `Your king is ${ownKingSafety}. Consider castling, advancing shield pawns, or trading attacking pieces.`,
      squares: kingSquare ? [kingSquare] : [],
      arrows: [],
      priority: 7,
    });
  }

  // --- Open file control ---
  const openFiles = findOpenFiles(board);
  const semiOpenFiles = findSemiOpenFiles(board, sideToMove);
  const rooksOnFiles = findRooksOnFiles(board, sideToMove, [...openFiles, ...semiOpenFiles]);

  if (openFiles.length > 0 && rooksOnFiles.length < openFiles.length) {
    // There are open files without rooks
    const targetFile = openFiles[0];
    const fileSquares = getFileSquares(targetFile);
    ideas.push({
      title: 'Contest Open File',
      description: `The ${String.fromCharCode(97 + targetFile)}-file is open. Place rooks here to control it.`,
      squares: fileSquares.slice(2, 6) as Square[],
      arrows: findUnplacedRooks(board, sideToMove, targetFile),
      priority: 6,
    });
  }

  // --- Weak squares / outposts ---
  const outposts = findOutposts(board, sideToMove);
  if (outposts.length > 0) {
    const knights = findPieceSquares(board, sideToMove, 'n');
    const arrowsToOutpost = knights
      .map((k) => ({ from: k, to: outposts[0] }))
      .slice(0, 2);

    ideas.push({
      title: 'Occupy Outpost',
      description: `${outposts[0]} is a strong outpost that cannot be challenged by enemy pawns. A knight here would be powerful.`,
      squares: outposts.slice(0, 3),
      arrows: arrowsToOutpost,
      priority: 5,
    });
  }

  // --- Pawn break ideas from engine PV ---
  if (engineLines && engineLines.length > 0) {
    const pvIdeas = extractPvIdeas(fen, engineLines[0], sideToMove);
    ideas.push(...pvIdeas);
  }

  // --- Piece improvement (low mobility side) ---
  const mobDiff = analysis.activity.whiteMobility - analysis.activity.blackMobility;
  const isCramped = (sideToMove === 'w' && mobDiff < -8) || (sideToMove === 'b' && mobDiff > 8);
  if (isCramped) {
    ideas.push({
      title: 'Improve Piece Activity',
      description: 'Your pieces are cramped. Look for exchanges or pawn breaks to free your position.',
      squares: [],
      arrows: [],
      priority: 4,
    });
  }

  // Sort by priority descending, limit to top 4
  ideas.sort((a, b) => b.priority - a.priority);
  return ideas.slice(0, 4);
}

// --- Helper functions ---

function findKing(board: ReturnType<Chess['board']>, color: 'w' | 'b'): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) {
        return (String.fromCharCode(97 + c) + (8 - r)) as Square;
      }
    }
  }
  return null;
}

function getAdjacentSquares(sq: Square): Square[] {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  const adj: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = file + df;
      const r = rank + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8) {
        adj.push((String.fromCharCode(97 + f) + (r + 1)) as Square);
      }
    }
  }
  return adj;
}

function findPiecesAimingAt(
  chess: Chess,
  color: 'w' | 'b',
  targetSquares: Square[],
): { from: Square; to: Square }[] {
  const results: { from: Square; to: Square }[] = [];
  const targetSet = new Set(targetSquares);

  // Check all legal moves from this side
  const parts = chess.fen().split(' ');
  parts[1] = color;
  try {
    const tempChess = new Chess(parts.join(' '));
    const moves = tempChess.moves({ verbose: true });
    for (const m of moves) {
      if (targetSet.has(m.to as Square) && m.piece !== 'p' && m.piece !== 'k') {
        results.push({ from: m.from as Square, to: m.to as Square });
      }
    }
  } catch {
    // ignore invalid position
  }
  return results;
}

function findOpenFiles(board: ReturnType<Chess['board']>): number[] {
  const files: number[] = [];
  for (let c = 0; c < 8; c++) {
    let hasPawn = false;
    for (let r = 0; r < 8; r++) {
      const p = board[r][c];
      if (p && p.type === 'p') { hasPawn = true; break; }
    }
    if (!hasPawn) files.push(c);
  }
  return files;
}

function findSemiOpenFiles(board: ReturnType<Chess['board']>, color: 'w' | 'b'): number[] {
  const files: number[] = [];
  for (let c = 0; c < 8; c++) {
    let hasOwnPawn = false;
    let hasEnemyPawn = false;
    for (let r = 0; r < 8; r++) {
      const p = board[r][c];
      if (p && p.type === 'p') {
        if (p.color === color) hasOwnPawn = true;
        else hasEnemyPawn = true;
      }
    }
    if (!hasOwnPawn && hasEnemyPawn) files.push(c);
  }
  return files;
}

function findRooksOnFiles(
  board: ReturnType<Chess['board']>,
  color: 'w' | 'b',
  files: number[],
): Square[] {
  const fileSet = new Set(files);
  const result: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'r' && p.color === color && fileSet.has(c)) {
        result.push((String.fromCharCode(97 + c) + (8 - r)) as Square);
      }
    }
  }
  return result;
}

function findUnplacedRooks(
  board: ReturnType<Chess['board']>,
  color: 'w' | 'b',
  targetFile: number,
): { from: Square; to: Square }[] {
  const results: { from: Square; to: Square }[] = [];
  const targetSq = (String.fromCharCode(97 + targetFile) + (color === 'w' ? '1' : '8')) as Square;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'r' && p.color === color && c !== targetFile) {
        results.push({
          from: (String.fromCharCode(97 + c) + (8 - r)) as Square,
          to: targetSq,
        });
      }
    }
  }
  return results.slice(0, 2);
}

function getFileSquares(file: number): Square[] {
  const f = String.fromCharCode(97 + file);
  return Array.from({ length: 8 }, (_, i) => (f + (i + 1)) as Square);
}

function findOutposts(board: ReturnType<Chess['board']>, color: 'w' | 'b'): Square[] {
  // An outpost is a square in the enemy half that can't be attacked by enemy pawns
  const outposts: Square[] = [];
  const enemyColor = color === 'w' ? 'b' : 'w';
  const centralFiles = [2, 3, 4, 5]; // c-f files
  const rankRange = color === 'w' ? [4, 5, 6] : [1, 2, 3]; // ranks 5-7 for white, 2-4 for black (0-indexed)

  for (const rank of rankRange) {
    for (const file of centralFiles) {
      // Check if enemy pawns can attack this square
      let canBeAttacked = false;
      const adjFiles = [file - 1, file + 1].filter((f) => f >= 0 && f < 8);

      for (const af of adjFiles) {
        // Look for enemy pawns that could advance to attack this square
        if (enemyColor === 'w') {
          for (let r = rank + 1; r < 7; r++) {
            const p = board[r][af];
            if (p && p.type === 'p' && p.color === 'w') { canBeAttacked = true; break; }
          }
        } else {
          for (let r = rank - 1; r > 0; r--) {
            const p = board[r][af];
            if (p && p.type === 'p' && p.color === 'b') { canBeAttacked = true; break; }
          }
        }
      }

      if (!canBeAttacked) {
        // Also check it's not occupied by a friendly pawn (we want piece outposts)
        const p = board[rank][file];
        if (!p || p.color !== color || p.type !== 'p') {
          outposts.push((String.fromCharCode(97 + file) + (8 - rank)) as Square);
        }
      }
    }
  }

  return outposts.slice(0, 4);
}

function findPieceSquares(board: ReturnType<Chess['board']>, color: 'w' | 'b', pieceType: string): Square[] {
  const squares: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === pieceType && p.color === color) {
        squares.push((String.fromCharCode(97 + c) + (8 - r)) as Square);
      }
    }
  }
  return squares;
}

/** Extract strategic themes from the engine's top PV */
function extractPvIdeas(fen: string, line: EngineLine, sideToMove: 'w' | 'b'): StrategicIdea[] {
  const ideas: StrategicIdea[] = [];
  const chess = new Chess(fen);
  const side = sideToMove === 'w' ? 'White' : 'Black';

  const pawnBreaks: { from: Square; to: Square }[] = [];
  const pieceLifts: { from: Square; to: Square; piece: string }[] = [];

  for (let i = 0; i < Math.min(line.pvUci.length, 10); i++) {
    const uci = line.pvUci[i];
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const isOurMove = (sideToMove === 'w') ? (i % 2 === 0) : (i % 2 === 1);

    try {
      const piece = chess.get(from);
      const target = chess.get(to);

      if (isOurMove && piece) {
        // Pawn break: pawn captures centrally
        if (piece.type === 'p' && target) {
          const toFile = to.charCodeAt(0) - 97;
          if (toFile >= 2 && toFile <= 5) {
            pawnBreaks.push({ from, to });
          }
        }

        // Rook lift or piece redeployment (rook moving to an open file or forward)
        if (piece.type === 'r') {
          pieceLifts.push({ from, to, piece: 'rook' });
        }
      }

      chess.move({ from, to, promotion });
    } catch {
      break;
    }
  }

  if (pawnBreaks.length > 0) {
    ideas.push({
      title: 'Pawn Break',
      description: `${side} should prepare the pawn break ${pawnBreaks[0].from}-${pawnBreaks[0].to} to open the position.`,
      squares: [pawnBreaks[0].from, pawnBreaks[0].to],
      arrows: pawnBreaks.slice(0, 2),
      priority: 7,
    });
  }

  if (pieceLifts.length > 0) {
    ideas.push({
      title: 'Reposition Rook',
      description: `${side} should redeploy the rook from ${pieceLifts[0].from} to ${pieceLifts[0].to} for better activity.`,
      squares: [pieceLifts[0].to],
      arrows: [pieceLifts[0]],
      priority: 5,
    });
  }

  return ideas;
}
