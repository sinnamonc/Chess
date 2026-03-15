import { useMemo, useState, useEffect } from 'react';
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

const ARROW_INTERVAL_MS = 800;

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

  if (move.flags.includes('k') || move.flags.includes('q')) {
    return ARROW_COLORS.blue;
  }
  if (move.san.includes('#')) return ARROW_COLORS.red;
  if (move.san.includes('+')) return ARROW_COLORS.red;
  if (move.captured) return ARROW_COLORS.red;

  return ARROW_COLORS.green;
}

interface ArrowData {
  startSquare: string;
  endSquare: string;
  color: string;
}

/** Build all arrows from PV with semantic colors and fading opacity */
function buildLineArrows(fen: string, pvUci: string[]): ArrowData[] {
  const arrows: ArrowData[] = [];
  const chess = new Chess(fen);
  const movesToShow = Math.min(pvUci.length, 6);
  const opacities = [0.9, 0.65, 0.5, 0.38, 0.28, 0.2];

  for (let i = 0; i < movesToShow; i++) {
    const uci = pvUci[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    let moveResult;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch {
      break;
    }
    if (!moveResult) break;

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

  const allArrows = useMemo(
    () => buildLineArrows(fen, line.pvUci),
    [fen, line.pvUci]
  );

  // Animate: reveal arrows one at a time, then pause, then reset
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (allArrows.length === 0) return;

    setVisibleCount(0);

    // Total cycle: one tick per arrow + one longer pause at the end before reset
    // visibleCount goes 0 → 1 → 2 → ... → allArrows.length → (pause) → 0
    let step = 0;
    const tick = () => {
      step++;
      if (step <= allArrows.length) {
        setVisibleCount(step);
      } else {
        // Reset after pause
        step = 0;
        setVisibleCount(0);
      }
    };

    // First arrow appears after initial delay
    const firstTimeout = setTimeout(() => {
      tick();
      // Then set up interval for remaining arrows
      const id = setInterval(() => {
        // Use longer delay when all arrows are shown (pause at end)
        tick();
      }, ARROW_INTERVAL_MS);
      intervalRef = id;
    }, ARROW_INTERVAL_MS);

    let intervalRef: ReturnType<typeof setInterval> | null = null;

    return () => {
      clearTimeout(firstTimeout);
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [allArrows.length, fen, line.pvUci]);

  const visibleArrows = allArrows.slice(0, visibleCount);

  // Format the SAN continuation
  const sanDisplay = useMemo(() => {
    const parts = fen.split(' ');
    const sideToMove = parts[1] || 'w';
    let moveNum = parseInt(parts[5] || '1');

    const formatted: string[] = [];
    for (let i = 0; i < Math.min(line.pvSan.length, 8); i++) {
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
            arrows: visibleArrows,
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
