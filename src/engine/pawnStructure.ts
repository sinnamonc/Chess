import { Chess, type Square } from 'chess.js';
import type { PawnAnalysis } from '../types';

interface PawnMap {
  white: Square[];
  black: Square[];
}

function getPawns(chess: Chess): PawnMap {
  const board = chess.board();
  const white: Square[] = [];
  const black: Square[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'p') {
        const sq = (String.fromCharCode(97 + c) + String(8 - r)) as Square;
        if (piece.color === 'w') white.push(sq);
        else black.push(sq);
      }
    }
  }

  return { white, black };
}

function getFile(sq: Square): number {
  return sq.charCodeAt(0) - 97;
}

function getRank(sq: Square): number {
  return parseInt(sq[1]);
}

function countDoubled(pawns: Square[]): number {
  const fileCounts = new Map<number, number>();
  for (const p of pawns) {
    const f = getFile(p);
    fileCounts.set(f, (fileCounts.get(f) || 0) + 1);
  }
  let doubled = 0;
  for (const count of fileCounts.values()) {
    if (count > 1) doubled += count - 1;
  }
  return doubled;
}

function countIsolated(pawns: Square[]): number {
  const files = new Set(pawns.map(getFile));
  let isolated = 0;
  for (const f of files) {
    if (!files.has(f - 1) && !files.has(f + 1)) {
      isolated++;
    }
  }
  return isolated;
}

function findPassed(ownPawns: Square[], oppPawns: Square[], color: 'w' | 'b'): Square[] {
  const passed: Square[] = [];

  for (const pawn of ownPawns) {
    const file = getFile(pawn);
    const rank = getRank(pawn);
    let isPassed = true;

    for (const opp of oppPawns) {
      const oppFile = getFile(opp);
      const oppRank = getRank(opp);

      // Check if opponent pawn is on same or adjacent file and ahead
      if (Math.abs(oppFile - file) <= 1) {
        if (color === 'w' && oppRank > rank) {
          isPassed = false;
          break;
        }
        if (color === 'b' && oppRank < rank) {
          isPassed = false;
          break;
        }
      }
    }

    if (isPassed) {
      passed.push(pawn);
    }
  }

  return passed;
}

export function analyzePawnStructure(fen: string): PawnAnalysis {
  const chess = new Chess(fen);
  const { white, black } = getPawns(chess);

  const whiteDoubled = countDoubled(white);
  const blackDoubled = countDoubled(black);
  const whiteIsolated = countIsolated(white);
  const blackIsolated = countIsolated(black);
  const whitePassed = findPassed(white, black, 'w');
  const blackPassed = findPassed(black, white, 'b');

  const observations: string[] = [];

  // Passed pawns
  if (whitePassed.length > 0) {
    observations.push(
      whitePassed.length === 1
        ? `White has a passed pawn on ${whitePassed[0]} that could become dangerous.`
        : `White has ${whitePassed.length} passed pawns — a significant asset!`
    );
  }
  if (blackPassed.length > 0) {
    observations.push(
      blackPassed.length === 1
        ? `Black has a passed pawn on ${blackPassed[0]} that could become dangerous.`
        : `Black has ${blackPassed.length} passed pawns — a significant asset!`
    );
  }

  // Weaknesses
  if (whiteIsolated > 0) {
    observations.push(`White has ${whiteIsolated} isolated pawn${whiteIsolated > 1 ? 's' : ''} — potential weaknesses.`);
  }
  if (blackIsolated > 0) {
    observations.push(`Black has ${blackIsolated} isolated pawn${blackIsolated > 1 ? 's' : ''} — potential weaknesses.`);
  }
  if (whiteDoubled > 0) {
    observations.push(`White has doubled pawns.`);
  }
  if (blackDoubled > 0) {
    observations.push(`Black has doubled pawns.`);
  }

  const summary = observations.length > 0
    ? observations.join(' ')
    : 'The pawn structure is healthy for both sides.';

  return {
    whiteDoubled,
    blackDoubled,
    whiteIsolated,
    blackIsolated,
    whitePassed,
    blackPassed,
    summary,
  };
}
