import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { EngineLine } from '../../types';
import styles from './VariationBoard.module.css';

interface VariationBoardProps {
  fen: string;
  line: EngineLine;
}

const RANK_COLORS: Record<number, string> = {
  1: 'rgba(0, 180, 90, 0.85)',
  2: 'rgba(50, 130, 220, 0.85)',
  3: 'rgba(180, 140, 30, 0.85)',
};

/** Format eval for display */
function formatEval(line: EngineLine): string {
  if (line.mate !== null) {
    return `M${line.mate}`;
  }
  if (line.cp === null) return '0.0';
  const val = line.cp / 100;
  return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
}

/** Build arrows from the PV line, showing the first few moves */
function buildLineArrows(fen: string, pvUci: string[], rankColor: string) {
  const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  // Show up to 3 moves as arrows (alternating colors for clarity)
  const chess = new Chess(fen);
  const movesToShow = Math.min(pvUci.length, 4);
  const opacities = [0.9, 0.55, 0.35, 0.2];

  for (let i = 0; i < movesToShow; i++) {
    const uci = pvUci[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    // Parse the base color to apply varying opacity
    const baseMatch = rankColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const color = baseMatch
      ? `rgba(${baseMatch[1]}, ${baseMatch[2]}, ${baseMatch[3]}, ${opacities[i]})`
      : rankColor;

    arrows.push({ startSquare: from, endSquare: to, color });

    // Advance the position
    try {
      chess.move({ from, to, promotion });
    } catch {
      break;
    }
  }

  return arrows;
}

export default function VariationBoard({ fen, line }: VariationBoardProps) {
  const rankColor = RANK_COLORS[line.rank] || RANK_COLORS[3];
  const evalStr = formatEval(line);
  const isPositive = (line.cp !== null && line.cp > 0) || (line.mate !== null && line.mate > 0);
  const isNegative = (line.cp !== null && line.cp < 0) || (line.mate !== null && line.mate < 0);

  const arrows = useMemo(
    () => buildLineArrows(fen, line.pvUci, rankColor),
    [fen, line.pvUci, rankColor]
  );

  // Format the SAN continuation
  const sanDisplay = useMemo(() => {
    // Figure out the move number context from FEN
    const parts = fen.split(' ');
    const sideToMove = parts[1] || 'w';
    let moveNum = parseInt(parts[5] || '1');

    const formatted: string[] = [];
    for (let i = 0; i < Math.min(line.pvSan.length, 4); i++) {
      const isWhite = (sideToMove === 'w' && i % 2 === 0) || (sideToMove === 'b' && i % 2 === 1);
      if (isWhite) {
        if (sideToMove === 'b' && i === 0) moveNum++; // First white move after black started
        formatted.push(`${moveNum}.${line.pvSan[i]}`);
        if (i > 0 || sideToMove === 'w') moveNum++;
      } else {
        if (i === 0 && sideToMove === 'b') {
          formatted.push(`${moveNum}...${line.pvSan[i]}`);
        } else {
          formatted.push(line.pvSan[i]);
        }
      }
    }
    return formatted.join(' ');
  }, [fen, line.pvSan]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span
          className={styles.rankBadge}
          style={{ backgroundColor: rankColor }}
        >
          {line.rank}
        </span>
        <span className={`${styles.eval} ${isPositive ? styles.evalWhite : isNegative ? styles.evalBlack : ''}`}>
          {evalStr}
        </span>
      </div>
      <div className={styles.boardWrap}>
        <Chessboard
          options={{
            position: fen,
            arrows,
            darkSquareStyle: { backgroundColor: '#4a6741' },
            lightSquareStyle: { backgroundColor: '#e8dcc8' },
            animationDurationInMs: 0,
            allowDragging: false,
            allowDrawingArrows: false,
          }}
        />
      </div>
      <div className={styles.continuation}>
        {sanDisplay}
      </div>
    </div>
  );
}
