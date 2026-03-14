import type { Square } from 'chess.js';

// Arrow annotation on the board
export interface Arrow {
  from: Square;
  to: Square;
  color: 'green' | 'red' | 'yellow' | 'blue';
}

// Position feel — qualitative assessment replacing eval bar
export type PositionFeel =
  | 'equal'
  | 'roughly equal'
  | 'slight edge white'
  | 'slight edge black'
  | 'clear advantage white'
  | 'clear advantage black'
  | 'white is winning'
  | 'black is winning'
  | 'unclear — double-edged'
  | 'white has compensation'
  | 'black has compensation';

// Tags describing what kind of move this is
export type MoveTag =
  | 'capture'
  | 'check'
  | 'checkmate'
  | 'castles'
  | 'sacrifice'
  | 'recapture'
  | 'developing'
  | 'pawn break'
  | 'trade'
  | 'quiet'
  | 'forcing'
  | 'promotion';

// Insight categories
export type InsightCategory =
  | 'material'
  | 'king_safety'
  | 'pawn_structure'
  | 'piece_activity'
  | 'center'
  | 'threats';

// A single positional insight
export interface PositionInsight {
  category: InsightCategory;
  summary: string;
  detail?: string;
}

// Move quality classification based on engine eval difference
export type MoveQuality =
  | 'brilliant'   // Found a move much better than expected (sacrifice that's best)
  | 'great'       // Best move or very close (within 10cp)
  | 'good'        // Decent move (within 30cp of best)
  | 'inaccuracy'  // Small mistake (30-80cp loss)
  | 'mistake'     // Significant error (80-200cp loss)
  | 'blunder';    // Major error (200+cp loss)

// Engine evaluation for a position
export interface EngineEvaluation {
  /** Centipawns from white's perspective. null when mate. */
  cp: number | null;
  /** Mate in N (positive = white mates). null if not a mate position. */
  mate: number | null;
  /** Best move in SAN notation (e.g. "Nf3") */
  bestMoveSan: string;
  /** Best move in UCI notation (e.g. "g1f3") */
  bestMoveUci: string;
  /** Search depth */
  depth: number;
}

// A fully analyzed move
export interface AnalyzedMove {
  moveNumber: number;
  san: string;
  color: 'w' | 'b';
  fen: string;
  fenBefore: string;
  narrative: string;
  arrows: Arrow[];
  highlights: Square[];
  positionFeel: PositionFeel;
  tags: MoveTag[];
  insights: PositionInsight[];
  /** Engine evaluation of the position AFTER this move (from white's perspective) */
  engineEval?: EngineEvaluation;
  /** Engine evaluation of the position BEFORE this move */
  engineEvalBefore?: EngineEvaluation;
  /** Move quality classification based on engine analysis */
  moveQuality?: MoveQuality;
  /** Centipawn loss from the best move */
  cpLoss?: number;
}

// Parsed game headers
export interface GameHeaders {
  white: string;
  black: string;
  event: string;
  date: string;
  result: string;
  [key: string]: string;
}

// A fully parsed and analyzed game
export interface AnalyzedGame {
  headers: GameHeaders;
  moves: AnalyzedMove[];
  startingFen: string;
}

// Material count for a side
export interface MaterialCount {
  pawns: number;
  knights: number;
  bishops: number;
  rooks: number;
  queens: number;
  total: number;
}

// Material analysis result
export interface MaterialAnalysis {
  white: MaterialCount;
  black: MaterialCount;
  balance: number; // positive = white ahead
  summary: string;
  detail?: string;
}

// King safety analysis result
export interface KingSafetyAnalysis {
  whiteCastled: boolean;
  blackCastled: boolean;
  whiteKingSafety: 'safe' | 'moderate' | 'exposed' | 'dangerous';
  blackKingSafety: 'safe' | 'moderate' | 'exposed' | 'dangerous';
  summary: string;
  detail?: string;
}

// Pawn structure analysis
export interface PawnAnalysis {
  whiteDoubled: number;
  blackDoubled: number;
  whiteIsolated: number;
  blackIsolated: number;
  whitePassed: Square[];
  blackPassed: Square[];
  summary: string;
  detail?: string;
}

// Piece activity analysis
export interface ActivityAnalysis {
  whiteMobility: number;
  blackMobility: number;
  summary: string;
  detail?: string;
}

// Full position analysis
export interface PositionAnalysis {
  material: MaterialAnalysis;
  kingSafety: KingSafetyAnalysis;
  pawns: PawnAnalysis;
  activity: ActivityAnalysis;
  threats: string[];
  positionFeel: PositionFeel;
}

// Move context for narrative generation
export interface MoveContext {
  san: string;
  color: 'w' | 'b';
  moveNumber: number;
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
  isPromotion: boolean;
  pieceMoved: string;
  from: Square;
  to: Square;
  capturedPiece?: string;
  analysisBefore: PositionAnalysis;
  analysisAfter: PositionAnalysis;
  tags: MoveTag[];
}
