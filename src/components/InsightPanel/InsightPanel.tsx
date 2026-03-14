import { useState } from 'react';
import type { AnalyzedMove, InsightCategory, MoveQuality } from '../../types';
import styles from './InsightPanel.module.css';

interface InsightPanelProps {
  move: AnalyzedMove | null;
  moveIndex: number;
  totalMoves: number;
  gameInfo?: { white: string; black: string; event: string; result: string };
}

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  material: 'Material',
  king_safety: 'King Safety',
  pawn_structure: 'Pawn Structure',
  piece_activity: 'Piece Activity',
  center: 'Center Control',
  threats: 'Threats',
};

const CATEGORY_ICONS: Record<InsightCategory, string> = {
  material: '\u2696', // balance scale
  king_safety: '\u265A', // king
  pawn_structure: '\u265F', // pawn
  piece_activity: '\u265E', // knight
  center: '\u25A3', // square
  threats: '\u26A0', // warning
};

const QUALITY_CONFIG: Record<MoveQuality, { label: string; className: string; symbol: string }> = {
  brilliant:   { label: 'Brilliant',   className: 'qualityBrilliant',   symbol: '!!' },
  great:       { label: 'Great move',  className: 'qualityGreat',       symbol: '!' },
  good:        { label: 'Good move',   className: 'qualityGood',        symbol: '' },
  inaccuracy:  { label: 'Inaccuracy',  className: 'qualityInaccuracy',  symbol: '?!' },
  mistake:     { label: 'Mistake',     className: 'qualityMistake',     symbol: '?' },
  blunder:     { label: 'Blunder',     className: 'qualityBlunder',     symbol: '??' },
};

export default function InsightPanel({ move, moveIndex, totalMoves, gameInfo }: InsightPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<InsightCategory | null>(null);

  if (!move) {
    // Starting position
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          {gameInfo && (
            <>
              <h2 className={styles.players}>
                {gameInfo.white} vs {gameInfo.black}
              </h2>
              {gameInfo.event && (
                <p className={styles.event}>{gameInfo.event}</p>
              )}
              <p className={styles.result}>Result: {gameInfo.result}</p>
            </>
          )}
        </div>
        <div className={styles.narrative}>
          <p className={styles.narrativeText}>
            Navigate through the moves to see analysis and insights for each position.
            Use the arrow keys or buttons below to step through the game.
          </p>
        </div>
      </div>
    );
  }

  const side = move.color === 'w' ? 'White' : 'Black';
  const qualityInfo = move.moveQuality ? QUALITY_CONFIG[move.moveQuality] : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.moveInfo}>
          <span className={styles.moveLabel}>
            Move {move.moveNumber}
          </span>
          <span className={styles.moveSan}>
            {side}: {move.san}
            {qualityInfo?.symbol && (
              <span className={`${styles.qualitySymbol} ${styles[qualityInfo.className]}`}>
                {qualityInfo.symbol}
              </span>
            )}
          </span>
          <span className={styles.moveCount}>
            {moveIndex + 1} / {totalMoves}
          </span>
        </div>

        {/* Move quality badge */}
        {qualityInfo && (
          <div className={`${styles.qualityBadge} ${styles[qualityInfo.className]}`}>
            {qualityInfo.label}
            {move.cpLoss !== undefined && move.cpLoss > 0 && (
              <span className={styles.cpLoss}>
                {' '}&minus;{(move.cpLoss / 100).toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Best move hint — show when the played move wasn't the best */}
      {move.engineEvalBefore && move.moveQuality && move.moveQuality !== 'great' && move.moveQuality !== 'brilliant' && move.moveQuality !== 'good' && (
        <div className={styles.bestMove}>
          Best was <strong>{move.engineEvalBefore.bestMoveSan}</strong>
        </div>
      )}

      {/* Narrative — the star feature */}
      <div className={styles.narrative}>
        <p className={styles.narrativeText}>{move.narrative}</p>
      </div>

      {/* Position insights */}
      <div className={styles.insights}>
        <h4 className={styles.insightsHeading}>Position Breakdown</h4>
        {move.insights.map((insight) => (
          <div
            key={insight.category}
            className={`${styles.insightCard} ${expandedCategory === insight.category ? styles.expanded : ''}`}
            onClick={() =>
              setExpandedCategory(
                expandedCategory === insight.category ? null : insight.category
              )
            }
          >
            <div className={styles.insightHeader}>
              <span className={styles.insightIcon}>
                {CATEGORY_ICONS[insight.category]}
              </span>
              <span className={styles.insightLabel}>
                {CATEGORY_LABELS[insight.category]}
              </span>
            </div>
            <p className={styles.insightSummary}>{insight.summary}</p>
            {insight.detail && expandedCategory === insight.category && (
              <p className={styles.insightDetail}>{insight.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
