import { Chessboard } from 'react-chessboard';
import type { Arrow } from '../../types';
import type { Square } from 'chess.js';
import styles from './Board.module.css';

interface BoardProps {
  fen: string;
  arrows: Arrow[];
  highlights: Square[];
  /** Extra arrows from strategic idea overlay */
  overlayArrows?: { from: Square; to: Square }[];
  /** Extra square highlights from strategic idea overlay */
  overlaySquares?: Square[];
}

export default function Board({ fen, arrows, highlights, overlayArrows, overlaySquares }: BoardProps) {
  // Convert arrows to react-chessboard format
  const boardArrows = arrows.map((a) => ({
    startSquare: a.from,
    endSquare: a.to,
    color: ARROW_COLORS[a.color] || ARROW_COLORS.green,
  }));

  // Add overlay arrows (strategic ideas) in purple
  if (overlayArrows) {
    for (const a of overlayArrows) {
      boardArrows.push({
        startSquare: a.from,
        endSquare: a.to,
        color: 'rgba(168, 85, 247, 0.75)',
      });
    }
  }

  // Build custom square styles for highlights
  const squareStyles: Record<string, React.CSSProperties> = {};
  for (const sq of highlights) {
    squareStyles[sq] = { backgroundColor: 'rgba(255, 255, 0, 0.3)' };
  }
  // Add overlay square highlights in purple
  if (overlaySquares) {
    for (const sq of overlaySquares) {
      squareStyles[sq] = { backgroundColor: 'rgba(168, 85, 247, 0.3)' };
    }
  }

  return (
    <div className={styles.boardContainer}>
      <Chessboard
        options={{
          position: fen,
          arrows: boardArrows,
          squareStyles,
          darkSquareStyle: { backgroundColor: '#4a6741' },
          lightSquareStyle: { backgroundColor: '#e8dcc8' },
          animationDurationInMs: 200,
          allowDragging: false,
          allowDrawingArrows: false,
        }}
      />
    </div>
  );
}

const ARROW_COLORS: Record<string, string> = {
  green: 'rgba(0, 180, 90, 0.8)',
  red: 'rgba(220, 50, 50, 0.8)',
  yellow: 'rgba(220, 180, 0, 0.8)',
  blue: 'rgba(50, 130, 220, 0.8)',
};
