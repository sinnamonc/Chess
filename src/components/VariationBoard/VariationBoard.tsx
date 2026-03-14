import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { EngineLine } from '../../types';
import styles from './VariationBoard.module.css';

interface VariationBoardProps {
  fen: string;
  line: EngineLine;
}

/** Same RGBA palette as the main board */
const ARROW_COLORS: Record<string, string> = {
  green: 'rgba(0, 180, 90, 0.8)',
  red: 'rgba(220, 50, 50, 0.8)',
  yellow: 'rgba(220, 180, 0, 0.8)',
  blue: 'rgba(50, 130, 220, 0.8)',
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

/** Classify a chess.js move result to get the semantic arrow color */
function getMoveArrowColor(move: ReturnType<Chess['move']>): string {
  if (!move) return ARROW_COLORS.green;

  // Castling
  if (move.flags.includes('k') || move.flags.includes('q')) {
    return ARROW_COLORS.blue;
  }

  // Check if it's a sacrifice: capturing a lower-value piece with a higher-value one
  // or moving a high-value piece to a square where it can be captured
  // Simplified: check + capture = red (it's forcing), just capture = red
  if (move.san.includes('#')) return ARROW_COLORS.red;
  if (move.san.includes('+')) return ARROW_COLORS.red;
  if (move.captured) return ARROW_COLORS.red;

  return ARROW_COLORS.green;
}

/** Build arrows from PV, using semantic colors with fading opacity */
function buildLineArrows(fen: string, pvUci: string[]) {
  const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  const chess = new Chess(fen);
  const movesToShow = Math.min(pvUci.length, 4);
  const opacities = [0.9, 0.55, 0.35, 0.2];

  for (let i = 0; i < movesToShow; i++) {
    const uci = pvUci[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    // Play the move to classify it
    let moveResult;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch {
      break;
    }
    if (!moveResult) break;

    // Get semantic color, then apply fading opacity
    const baseColor = getMoveArrowColor(moveResult);
    const baseMatch = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const color = baseMatch
      ? `rgba(${baseMatch[1]}, ${baseMatch[2]}, ${baseMatch[3]}, ${opacities[i]})`
      : baseColor;

    arrows.push({ startSquare: from, endSquare: to, color });
  }

  return arrows;
}

export default function VariationBoard({ fen, line }: VariationBoardProps) {
  const evalStr = formatEval(line);
  const isPositive = (line.cp !== null && line.cp > 0) || (line.mate !== null && line.mate > 0);
  const isNegative = (line.cp !== null && line.cp < 0) || (line.mate !== null && line.mate < 0);

  const arrows = useMemo(
    () => buildLineArrows(fen, line.pvUci),
    [fen, line.pvUci]
  );

  // Format the SAN continuation
  const sanDisplay = useMemo(() => {
    const parts = fen.split(' ');
    const sideToMove = parts[1] || 'w';
    let moveNum = parseInt(parts[5] || '1');

    const formatted: string[] = [];
    for (let i = 0; i < Math.min(line.pvSan.length, 4); i++) {
      const isWhite = (sideToMove === 'w' && i % 2 === 0) || (sideToMove === 'b' && i % 2 === 1);
      if (isWhite) {
        if (sideToMove === 'b' && i === 0) moveNum++;
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

  // Rank badge color — keep distinct per rank for identification
  const rankBadgeColor: Record<number, string> = {
    1: '#22c55e',
    2: '#3b82f6',
    3: '#b4960a',
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span
          className={styles.rankBadge}
          style={{ backgroundColor: rankBadgeColor[line.rank] || rankBadgeColor[3] }}
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
