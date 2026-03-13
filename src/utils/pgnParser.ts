import { Chess } from 'chess.js';
import type { GameHeaders } from '../types';

export interface ParsedMove {
  moveNumber: number;
  san: string;
  color: 'w' | 'b';
  fen: string;
  fenBefore: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
  isPromotion: boolean;
}

export interface ParsedGame {
  headers: GameHeaders;
  moves: ParsedMove[];
  startingFen: string;
}

/**
 * Extract PGN headers from raw PGN text
 */
function parseHeaders(pgn: string): GameHeaders {
  const headers: GameHeaders = {
    white: 'Unknown',
    black: 'Unknown',
    event: 'Unknown Event',
    date: '',
    result: '*',
  };

  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(pgn)) !== null) {
    const key = match[1].toLowerCase();
    headers[key] = match[2];
  }

  return headers;
}

/**
 * Parse a PGN string into a structured game with positions at each move
 */
export function parsePgn(pgn: string): ParsedGame {
  const headers = parseHeaders(pgn);
  const chess = new Chess();

  // Try to load the PGN
  try {
    chess.loadPgn(pgn);
  } catch {
    throw new Error(
      'Invalid PGN format. Please check your PGN and try again.'
    );
  }

  // Get the move history with details
  const history = chess.history({ verbose: true });

  // Reset to replay and capture FENs
  chess.reset();
  const startingFen = chess.fen();
  const moves: ParsedMove[] = [];

  for (const move of history) {
    const fenBefore = chess.fen();
    chess.move(move.san);
    const fenAfter = chess.fen();

    const isCastling = move.san === 'O-O' || move.san === 'O-O-O';

    moves.push({
      moveNumber: Math.ceil(moves.length / 2) + (moves.length % 2 === 0 ? 0 : 0),
      san: move.san,
      color: move.color,
      fen: fenAfter,
      fenBefore,
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      isCheck: move.san.includes('+') || move.san.includes('#'),
      isCheckmate: move.san.includes('#'),
      isCastling,
      isPromotion: !!move.promotion,
    });
  }

  // Fix move numbers
  for (let i = 0; i < moves.length; i++) {
    moves[i].moveNumber = Math.floor(i / 2) + 1;
  }

  return { headers, moves, startingFen };
}
