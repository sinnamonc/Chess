import type { PositionAnalysis, PositionFeel, MoveTag, AnalyzedMove, PositionInsight } from '../types';
import type { ParsedMove, ParsedGame } from '../utils/pgnParser';
import { analyzeMaterial, isSacrifice } from './material';
import { analyzeKingSafety } from './kingSafety';
import { analyzePawnStructure } from './pawnStructure';
import { analyzeActivity } from './pieceActivity';
import { detectThreats } from './tactics';
import { generateArrows } from './arrowGenerator';

/**
 * Analyze a position and return comprehensive analysis
 */
export function analyzePosition(fen: string): PositionAnalysis {
  const material = analyzeMaterial(fen);
  const kingSafety = analyzeKingSafety(fen);
  const pawns = analyzePawnStructure(fen);
  const activity = analyzeActivity(fen);
  const threatInfos = detectThreats(fen);
  const threats = threatInfos.map(t => t.description);

  // Determine position feel
  const positionFeel = determinePositionFeel(material.balance, kingSafety, activity, pawns);

  return { material, kingSafety, pawns, activity, threats, positionFeel };
}

/**
 * Determine qualitative position assessment
 */
function determinePositionFeel(
  materialBalance: number,
  kingSafety: { whiteKingSafety: string; blackKingSafety: string },
  activity: { whiteMobility: number; blackMobility: number },
  _pawns: { whitePassed: string[]; blackPassed: string[] }
): PositionFeel {
  // Material dominates
  if (materialBalance >= 5) return 'white is winning';
  if (materialBalance <= -5) return 'black is winning';

  // Check for compensation (material down but better activity/king safety)
  const mobilityDiff = activity.whiteMobility - activity.blackMobility;

  if (materialBalance >= 3) {
    if (mobilityDiff < -10) return 'unclear — double-edged';
    return 'clear advantage white';
  }
  if (materialBalance <= -3) {
    if (mobilityDiff > 10) return 'unclear — double-edged';
    return 'clear advantage black';
  }

  // King safety creates dynamism
  const whiteKingDanger = kingSafety.whiteKingSafety === 'dangerous' || kingSafety.whiteKingSafety === 'exposed';
  const blackKingDanger = kingSafety.blackKingSafety === 'dangerous' || kingSafety.blackKingSafety === 'exposed';

  if (whiteKingDanger && blackKingDanger) return 'unclear — double-edged';

  if (materialBalance >= 1) {
    if (blackKingDanger) return 'clear advantage white';
    return 'slight edge white';
  }
  if (materialBalance <= -1) {
    if (whiteKingDanger) return 'clear advantage black';
    return 'slight edge black';
  }

  // Material is equal — use positional factors
  if (mobilityDiff > 10) return 'slight edge white';
  if (mobilityDiff < -10) return 'slight edge black';

  if (whiteKingDanger && !blackKingDanger) {
    return materialBalance >= 0 ? 'black has compensation' : 'slight edge black';
  }
  if (blackKingDanger && !whiteKingDanger) {
    return materialBalance <= 0 ? 'white has compensation' : 'slight edge white';
  }

  if (Math.abs(mobilityDiff) > 5) {
    return mobilityDiff > 0 ? 'slight edge white' : 'slight edge black';
  }

  return 'roughly equal';
}

/**
 * Determine move tags
 */
function determineTags(move: ParsedMove, fenBefore: string, fenAfter: string, prevMove?: ParsedMove): MoveTag[] {
  const tags: MoveTag[] = [];

  if (move.isCheckmate) tags.push('checkmate');
  else if (move.isCheck) tags.push('check');

  if (move.isCastling) tags.push('castles');
  if (move.isPromotion) tags.push('promotion');

  // Detect recapture: previous move captured on the same square we're capturing on
  const isRecapture = !!(move.captured && prevMove?.captured && move.to === prevMove.to);

  if (move.captured) {
    tags.push('capture');
    if (isRecapture) tags.push('recapture');
  }

  // Check for sacrifice — but never on recaptures (recapturing is not a sacrifice)
  if (move.captured && !isRecapture && isSacrifice(fenBefore, fenAfter, move.piece, move.captured)) {
    tags.push('sacrifice');
  }

  // Developing moves (moving pieces from back rank in opening)
  if (!move.captured && !move.isCheck && !move.isCastling) {
    const fromRank = parseInt(move.from[1]);
    const isBackRank = (move.color === 'w' && fromRank <= 2) || (move.color === 'b' && fromRank >= 7);
    if (isBackRank && (move.piece === 'n' || move.piece === 'b')) {
      tags.push('developing');
    }
  }

  // Pawn break (pawn captures in the center)
  if (move.piece === 'p' && move.captured) {
    const toFile = move.to.charCodeAt(0) - 97;
    if (toFile >= 2 && toFile <= 5) {
      tags.push('pawn break');
    }
  }

  // Quiet move (no captures, checks, etc.)
  if (tags.length === 0) {
    tags.push('quiet');
  }

  // Forcing (check or capture)
  if (move.isCheck || move.captured) {
    tags.push('forcing');
  }

  return tags;
}

/**
 * Build position insights from analysis
 */
function buildInsights(analysis: PositionAnalysis): PositionInsight[] {
  const insights: PositionInsight[] = [];

  insights.push({
    category: 'material',
    summary: analysis.material.summary,
    detail: analysis.material.detail,
  });

  insights.push({
    category: 'king_safety',
    summary: analysis.kingSafety.summary,
    detail: analysis.kingSafety.detail,
  });

  if (analysis.pawns.summary !== 'The pawn structure is healthy for both sides.') {
    insights.push({
      category: 'pawn_structure',
      summary: analysis.pawns.summary,
      detail: analysis.pawns.detail,
    });
  }

  if (analysis.activity.summary !== 'Both sides have roughly equal piece activity.') {
    insights.push({
      category: 'piece_activity',
      summary: analysis.activity.summary,
      detail: analysis.activity.detail,
    });
  }

  if (analysis.threats.length > 0) {
    insights.push({
      category: 'threats',
      summary: analysis.threats[0],
      detail: analysis.threats.length > 1 ? analysis.threats.slice(1).join(' ') : undefined,
    });
  }

  return insights;
}

/**
 * Analyze an entire game
 */
export function analyzeGame(game: ParsedGame): AnalyzedMove[] {
  const analyzedMoves: AnalyzedMove[] = [];

  for (let i = 0; i < game.moves.length; i++) {
    const move = game.moves[i];
    const analysisBefore = analyzePosition(move.fenBefore);
    const analysisAfter = analyzePosition(move.fen);
    const prevMove = i > 0 ? game.moves[i - 1] : undefined;
    const tags = determineTags(move, move.fenBefore, move.fen, prevMove);

    const { arrows, highlights } = generateArrows(move, analysisBefore, analysisAfter, tags);
    const insights = buildInsights(analysisAfter);

    analyzedMoves.push({
      moveNumber: move.moveNumber,
      san: move.san,
      color: move.color,
      fen: move.fen,
      fenBefore: move.fenBefore,
      narrative: '',
      arrows,
      highlights: highlights as any,
      positionFeel: analysisAfter.positionFeel,
      tags,
      insights,
    });
  }

  return analyzedMoves;
}
