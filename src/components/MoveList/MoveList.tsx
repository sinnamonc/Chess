import { useRef, useEffect } from 'react';
import type { AnalyzedMove, MoveTag, MoveQuality } from '../../types';
import styles from './MoveList.module.css';

interface MoveListProps {
  moves: AnalyzedMove[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
}

const TAG_COLORS: Partial<Record<MoveTag, string>> = {
  sacrifice: '#f59e0b',
  checkmate: '#ef4444',
  check: '#f97316',
  capture: '#ef4444',
  castles: '#3b82f6',
  developing: '#22c55e',
  promotion: '#a855f7',
  'pawn break': '#06b6d4',
};

const QUALITY_DOTS: Partial<Record<MoveQuality, { color: string; symbol: string }>> = {
  brilliant:  { color: '#c084fc', symbol: '!!' },
  great:      { color: '#4ade80', symbol: '!' },
  inaccuracy: { color: '#facc15', symbol: '?!' },
  mistake:    { color: '#fb923c', symbol: '?' },
  blunder:    { color: '#f87171', symbol: '??' },
};

export default function MoveList({ moves, currentIndex, onMoveClick }: MoveListProps) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current && listRef.current) {
      const container = listRef.current;
      const el = activeRef.current;
      const elTop = el.offsetTop - container.offsetTop;
      const elBottom = elTop + el.offsetHeight;

      if (elTop < container.scrollTop) {
        container.scrollTop = elTop;
      } else if (elBottom > container.scrollTop + container.clientHeight) {
        container.scrollTop = elBottom - container.clientHeight;
      }
    }
  }, [currentIndex]);

  // Group moves into pairs (white, black)
  const rows: { number: number; white?: { move: AnalyzedMove; index: number }; black?: { move: AnalyzedMove; index: number } }[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.color === 'w') {
      rows.push({ number: move.moveNumber, white: { move, index: i } });
    } else {
      if (rows.length > 0 && !rows[rows.length - 1].black) {
        rows[rows.length - 1].black = { move, index: i };
      } else {
        rows.push({ number: move.moveNumber, black: { move, index: i } });
      }
    }
  }

  function getVisibleTag(tags: MoveTag[]): MoveTag | null {
    const priority: MoveTag[] = ['checkmate', 'sacrifice', 'check', 'capture', 'castles', 'promotion', 'developing', 'pawn break'];
    for (const t of priority) {
      if (tags.includes(t)) return t;
    }
    return null;
  }

  function renderMove(entry: { move: AnalyzedMove; index: number } | undefined, isActive: boolean) {
    if (!entry) return <span className={styles.emptyMove} />;

    const { move, index } = entry;
    const tag = getVisibleTag(move.tags);
    const qualityDot = move.moveQuality ? QUALITY_DOTS[move.moveQuality] : null;

    return (
      <span
        ref={isActive ? activeRef : undefined}
        className={`${styles.move} ${isActive ? styles.active : ''}`}
        onClick={() => onMoveClick(index)}
      >
        {qualityDot && (
          <span className={styles.qualityDot} style={{ color: qualityDot.color }}>
            {qualityDot.symbol}
          </span>
        )}
        <span className={styles.san}>{move.san}</span>
        {tag && (
          <span
            className={styles.tag}
            style={{ backgroundColor: TAG_COLORS[tag] || '#64748b' }}
          >
            {tag}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Moves</h3>
      <div className={styles.moveList} ref={listRef}>
        {rows.map((row, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.moveNumber}>{row.number}.</span>
            {renderMove(row.white, row.white?.index === currentIndex)}
            {renderMove(row.black, row.black?.index === currentIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}
