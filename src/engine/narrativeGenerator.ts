import type { MoveContext } from '../types';

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/**
 * Generate a human-readable narrative for a move
 */
export function generateNarrative(ctx: MoveContext): string {
  const side = ctx.color === 'w' ? 'White' : 'Black';
  const piece = PIECE_NAMES[ctx.pieceMoved] || ctx.pieceMoved;

  // Checkmate — most important
  if (ctx.isCheckmate) {
    return generateCheckmateNarrative(side, piece, ctx);
  }

  // Castling
  if (ctx.isCastling) {
    return generateCastlingNarrative(side, ctx);
  }

  // Sacrifice
  if (ctx.tags.includes('sacrifice')) {
    return generateSacrificeNarrative(side, piece, ctx);
  }

  // Capture
  if (ctx.isCapture) {
    return generateCaptureNarrative(side, piece, ctx);
  }

  // Check
  if (ctx.isCheck) {
    return generateCheckNarrative(side, piece, ctx);
  }

  // Promotion
  if (ctx.isPromotion) {
    return `${side} promotes a pawn — a potentially game-changing moment!`;
  }

  // Developing move
  if (ctx.tags.includes('developing')) {
    return generateDevelopmentNarrative(side, piece, ctx);
  }

  // Quiet positional move
  return generateQuietNarrative(side, piece, ctx);
}

function generateCheckmateNarrative(side: string, piece: string, ctx: MoveContext): string {
  const phrases = [
    `Checkmate! ${side} delivers the final blow with the ${piece}. Game over!`,
    `And it's checkmate! The ${piece} delivers the finishing strike. A decisive ending.`,
    `${side} plays ${ctx.san} — checkmate! The game is over.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generateCastlingNarrative(side: string, ctx: MoveContext): string {
  const isKingside = ctx.san === 'O-O';
  const direction = isKingside ? 'kingside' : 'queenside';

  const beforeSafety = ctx.color === 'w'
    ? ctx.analysisBefore.kingSafety.whiteKingSafety
    : ctx.analysisBefore.kingSafety.blackKingSafety;

  if (beforeSafety === 'dangerous' || beforeSafety === 'exposed') {
    return `${side} castles ${direction}, finally getting the king to safety. This was becoming urgent!`;
  }

  const phrases = [
    `${side} castles ${direction}, tucking the king to safety and connecting the rooks.`,
    `${side} castles ${direction} — a natural move, securing the king and activating the rook.`,
    `${side} gets the king to safety with ${direction} castling, a key step in development.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generateSacrificeNarrative(side: string, piece: string, ctx: MoveContext): string {
  const target = ctx.capturedPiece ? PIECE_NAMES[ctx.capturedPiece] : '';

  if (ctx.isCheck) {
    return `A bold sacrifice! ${side} gives up the ${piece}${target ? ` for a ${target}` : ''} with check — the initiative could be decisive.`;
  }

  // Check if the sacrifice improved king safety threats
  const opponentKingSafetyAfter = ctx.color === 'w'
    ? ctx.analysisAfter.kingSafety.blackKingSafety
    : ctx.analysisAfter.kingSafety.whiteKingSafety;

  if (opponentKingSafetyAfter === 'dangerous' || opponentKingSafetyAfter === 'exposed') {
    return `A stunning sacrifice! ${side} gives up the ${piece}, ripping open the opponent's king position. The attack looks ferocious!`;
  }

  const phrases = [
    `${side} sacrifices the ${piece}! Material isn't everything — this creates powerful compensation.`,
    `A daring sacrifice! ${side} parts with the ${piece}, betting on dynamic play and initiative.`,
    `${side} gives up the ${piece} — a creative sacrifice aiming for long-term advantages beyond material.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generateCaptureNarrative(side: string, piece: string, ctx: MoveContext): string {
  const target = ctx.capturedPiece ? PIECE_NAMES[ctx.capturedPiece] : 'piece';
  const materialBefore = ctx.analysisBefore.material.balance;
  const materialAfter = ctx.analysisAfter.material.balance;

  // Winning material
  const swing = ctx.color === 'w' ? materialAfter - materialBefore : materialBefore - materialAfter;

  if (swing >= 3) {
    return `${side} captures the ${target} on ${ctx.to} — winning significant material! This changes the game.`;
  }

  if (ctx.isCheck) {
    return `${side} captures the ${target} on ${ctx.to} with check! A strong forcing move.`;
  }

  // Even trade
  if (Math.abs(swing) <= 0.5) {
    const phrases = [
      `${side} trades ${piece} for ${target} on ${ctx.to}. The material balance stays even.`,
      `${side} captures the ${target} on ${ctx.to}, simplifying the position.`,
      `An exchange on ${ctx.to} — ${side} takes the ${target} with the ${piece}.`,
    ];
    return pick(phrases, ctx.moveNumber);
  }

  const phrases = [
    `${side} takes the ${target} on ${ctx.to} with the ${piece}.`,
    `${side} captures on ${ctx.to}, picking off the ${target}.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generateCheckNarrative(side: string, piece: string, ctx: MoveContext): string {
  const phrases = [
    `${side} plays ${ctx.san}, giving check! The ${piece} puts pressure on the opponent's king.`,
    `Check! ${side}'s ${piece} targets the king from ${ctx.to}. The opponent must respond immediately.`,
    `${side} gives check with the ${piece} — a forcing move that demands an answer.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generateDevelopmentNarrative(side: string, piece: string, ctx: MoveContext): string {
  // Detect what the piece is aiming at
  if (piece === 'knight') {
    if (ctx.to === 'f3' || ctx.to === 'f6') {
      return `${side} develops the knight to its most natural square, ${ctx.to}, controlling the center.`;
    }
    if (ctx.to === 'c3' || ctx.to === 'c6') {
      return `${side} develops the knight to ${ctx.to}, adding support to the center.`;
    }
    return `${side} brings the knight into the game on ${ctx.to}.`;
  }

  if (piece === 'bishop') {
    const phrases = [
      `${side} develops the bishop to ${ctx.to}, finding a good diagonal for this piece.`,
      `${side} brings the bishop to ${ctx.to}, where it can eye important squares.`,
      `The bishop comes to ${ctx.to} — ${side} continues development smoothly.`,
    ];
    return pick(phrases, ctx.moveNumber);
  }

  return `${side} develops the ${piece} to ${ctx.to}.`;
}

function generateQuietNarrative(side: string, piece: string, ctx: MoveContext): string {
  const mobilityBefore = ctx.color === 'w'
    ? ctx.analysisBefore.activity.whiteMobility
    : ctx.analysisBefore.activity.blackMobility;
  const mobilityAfter = ctx.color === 'w'
    ? ctx.analysisAfter.activity.whiteMobility
    : ctx.analysisAfter.activity.blackMobility;

  // Pawn moves
  if (piece === 'pawn') {
    return generatePawnNarrative(side, ctx);
  }

  // Rook to open file
  if (piece === 'rook') {
    return generateRookNarrative(side, ctx);
  }

  // Queen moves
  if (piece === 'queen') {
    const phrases = [
      `${side} repositions the queen to ${ctx.to}, a flexible move keeping many options open.`,
      `The queen moves to ${ctx.to} — ${side} improves this powerful piece's positioning.`,
      `${side} maneuvers the queen to ${ctx.to}, surveying the board from a new angle.`,
    ];
    return pick(phrases, ctx.moveNumber);
  }

  // King moves (not castling)
  if (piece === 'king') {
    return `${side} moves the king to ${ctx.to} — a practical decision to improve the king's position.`;
  }

  // Generic improvement
  if (mobilityAfter > mobilityBefore + 3) {
    return `${side} plays ${ctx.san}, significantly improving the position. The pieces are more harmonious now.`;
  }

  const phrases = [
    `${side} plays ${ctx.san}, a quiet move that improves the ${piece}'s position.`,
    `${side} repositions the ${piece} to ${ctx.to} — subtle but purposeful.`,
    `A calm move by ${side}: the ${piece} heads to ${ctx.to}, improving the overall coordination.`,
    `${side} plays ${ctx.san}, making a useful improvement to the position.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generatePawnNarrative(side: string, ctx: MoveContext): string {
  const toFile = ctx.to.charCodeAt(0) - 97;
  const toRank = parseInt(ctx.to[1]);
  const isCenter = toFile >= 2 && toFile <= 5 && (toRank === 4 || toRank === 5);

  if (isCenter) {
    const phrases = [
      `${side} pushes a pawn to the center with ${ctx.san}, staking a claim for central control.`,
      `${side} advances to ${ctx.to}, fighting for space in the center.`,
      `A central pawn push — ${side} plays ${ctx.san} to control key squares.`,
    ];
    return pick(phrases, ctx.moveNumber);
  }

  // Advanced pawn
  if ((ctx.color === 'w' && toRank >= 6) || (ctx.color === 'b' && toRank <= 3)) {
    return `${side} pushes the pawn to ${ctx.to} — this pawn is becoming a real threat as it advances!`;
  }

  const phrases = [
    `${side} plays ${ctx.san}, advancing the pawn.`,
    `${side} pushes to ${ctx.to} — a useful pawn move.`,
    `${side} plays ${ctx.san}, preparing for the next phase.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

function generateRookNarrative(side: string, ctx: MoveContext): string {
  const phrases = [
    `${side} places the rook on ${ctx.to}, looking to control this file.`,
    `The rook moves to ${ctx.to} — ${side} aims to dominate this part of the board.`,
    `${side} activates the rook on ${ctx.to}, increasing pressure.`,
  ];
  return pick(phrases, ctx.moveNumber);
}

/**
 * Deterministic but varied phrase selection based on move number
 */
function pick(phrases: string[], seed: number): string {
  return phrases[seed % phrases.length];
}
