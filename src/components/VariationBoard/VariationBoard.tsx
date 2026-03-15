import { useMemo, useState, useEffect, useCallback } from 'react';
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

/** Build FENs for each move in the PV (for click-to-explore) */
function buildPvFens(fen: string, pvUci: string[]): string[] {
  const fens: string[] = [];
  const chess = new Chess(fen);

  for (const uci of pvUci) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    try {
      chess.move({ from, to, promotion });
      fens.push(chess.fen());
    } catch {
      break;
    }
  }

  return fens;
}

/** Format SAN moves into tokens with move number prefixes */
function buildSanTokens(fen: string, pvSan: string[], count: number) {
  const parts = fen.split(' ');
  const sideToMove = parts[1] || 'w';
  let moveNum = parseInt(parts[5] || '1');

  const tokens: { text: string; moveIndex: number }[] = [];
  for (let i = 0; i < Math.min(pvSan.length, count); i++) {
    const isWhite = (sideToMove === 'w' && i % 2 === 0) || (sideToMove === 'b' && i % 2 === 1);
    let text: string;
    if (isWhite) {
      if (sideToMove === 'b' && i === 0) moveNum++;
      text = `${moveNum}.${pvSan[i]}`;
      if (i > 0 || sideToMove === 'w') moveNum++;
    } else {
      if (i === 0 && sideToMove === 'b') {
        text = `${moveNum}...${pvSan[i]}`;
      } else {
        text = pvSan[i];
      }
    }
    tokens.push({ text, moveIndex: i });
  }
  return tokens;
}

export default function VariationBoard({ fen, line }: VariationBoardProps) {
  const evalStr = formatEval(line);
  const isPositive = (line.cp !== null && line.cp > 0) || (line.mate !== null && line.mate > 0);
  const isNegative = (line.cp !== null && line.cp < 0) || (line.mate !== null && line.mate < 0);

  const allArrows = useMemo(
    () => buildLineArrows(fen, line.pvUci),
    [fen, line.pvUci]
  );

  const pvFens = useMemo(
    () => buildPvFens(fen, line.pvUci),
    [fen, line.pvUci]
  );

  const sanTokens = useMemo(
    () => buildSanTokens(fen, line.pvSan, 8),
    [fen, line.pvSan]
  );

  // Animate: reveal arrows one at a time, then pause, then reset
  const [visibleCount, setVisibleCount] = useState(0);
  // Which move the user clicked on (null = show animated arrows on base position)
  const [exploringIndex, setExploringIndex] = useState<number | null>(null);

  // Reset exploration when the line changes
  useEffect(() => {
    setExploringIndex(null);
  }, [fen, line.pvUci]);

  useEffect(() => {
    if (allArrows.length === 0 || exploringIndex !== null) return;

    setVisibleCount(0);

    let step = 0;
    const tick = () => {
      step++;
      if (step <= allArrows.length) {
        setVisibleCount(step);
      } else {
        step = 0;
        setVisibleCount(0);
      }
    };

    const firstTimeout = setTimeout(() => {
      tick();
      const id = setInterval(() => {
        tick();
      }, ARROW_INTERVAL_MS);
      intervalRef = id;
    }, ARROW_INTERVAL_MS);

    let intervalRef: ReturnType<typeof setInterval> | null = null;

    return () => {
      clearTimeout(firstTimeout);
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [allArrows.length, fen, line.pvUci, exploringIndex]);

  const handleMoveClick = useCallback((moveIdx: number) => {
    setExploringIndex((prev) => prev === moveIdx ? null : moveIdx);
  }, []);

  // Determine what to show on the board
  const boardFen = exploringIndex !== null && pvFens[exploringIndex]
    ? pvFens[exploringIndex]
    : fen;

  const visibleArrows = exploringIndex !== null
    ? [] // no arrows when exploring a specific position
    : allArrows.slice(0, visibleCount);

  // For highlighting: which move index is "active" in the animation
  const animActiveIndex = visibleCount > 0 ? visibleCount - 1 : -1;

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
            position: boardFen,
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
        {sanTokens.map((token) => {
          const isAnimActive = exploringIndex === null && token.moveIndex === animActiveIndex;
          const isExploring = exploringIndex === token.moveIndex;
          const isPast = exploringIndex === null
            ? token.moveIndex < visibleCount
            : token.moveIndex <= exploringIndex;
          return (
            <span
              key={token.moveIndex}
              className={`${styles.moveToken} ${isAnimActive ? styles.moveActive : ''} ${isExploring ? styles.moveExploring : ''} ${isPast ? styles.movePast : ''}`}
              onClick={() => handleMoveClick(token.moveIndex)}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
