import { useMemo, useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { EngineLine } from '../../types';
import styles from './VariationBoard.module.css';

interface VariationBoardProps {
  fen: string;
  line: EngineLine;
}

/** White's move colors (cool tones) */
const WHITE_COLORS = {
  base: { r: 0, g: 160, b: 220 },   // blue-cyan
  capture: { r: 70, g: 100, b: 220 }, // blue-purple for captures/checks
  castle: { r: 50, g: 130, b: 220 },  // blue
};

/** Black's move colors (warm tones) */
const BLACK_COLORS = {
  base: { r: 220, g: 140, b: 30 },    // amber-orange
  capture: { r: 220, g: 80, b: 50 },   // red-orange for captures/checks
  castle: { r: 200, g: 160, b: 50 },   // gold
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

function rgba(c: { r: number; g: number; b: number }, opacity: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
}

interface ArrowData {
  startSquare: string;
  endSquare: string;
  color: string;
}

interface ArrowMeta {
  arrow: ArrowData;
  number: number;
  fromSquare: string;
  isWhiteMove: boolean;
  labelColor: string;
}

/** Build all arrows with numbered metadata and alternating side colors */
function buildLineArrows(fen: string, pvUci: string[]): ArrowMeta[] {
  const result: ArrowMeta[] = [];
  const chess = new Chess(fen);
  const movesToShow = Math.min(pvUci.length, 6);
  const opacities = [0.85, 0.7, 0.55, 0.42, 0.32, 0.24];
  const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w';

  for (let i = 0; i < movesToShow; i++) {
    const uci = pvUci[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    // Determine which side is moving
    const isWhiteMove = (sideToMove === 'w') ? (i % 2 === 0) : (i % 2 === 1);
    const palette = isWhiteMove ? WHITE_COLORS : BLACK_COLORS;

    let moveResult;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch {
      break;
    }
    if (!moveResult) break;

    // Pick color variant based on move type
    let colorBase = palette.base;
    if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
      colorBase = palette.castle;
    } else if (moveResult.san.includes('#') || moveResult.san.includes('+') || moveResult.captured) {
      colorBase = palette.capture;
    }

    const color = rgba(colorBase, opacities[i]);
    const labelColor = rgba(colorBase, 1);

    result.push({
      arrow: { startSquare: from, endSquare: to, color },
      number: i + 1,
      fromSquare: from,
      isWhiteMove,
      labelColor,
    });
  }

  return result;
}

/** Convert square name to percentage position on the board */
function squareToPercent(square: string): { left: number; top: number } {
  const file = square.charCodeAt(0) - 97; // a=0, h=7
  const rank = parseInt(square[1]) - 1;   // 1=0, 8=7
  return {
    left: file * 12.5 + 6.25,  // center of square
    top: (7 - rank) * 12.5 + 6.25,
  };
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

  const tokens: { text: string; moveIndex: number; isWhite: boolean }[] = [];
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
    tokens.push({ text, moveIndex: i, isWhite });
  }
  return tokens;
}

export default function VariationBoard({ fen, line }: VariationBoardProps) {
  const evalStr = formatEval(line);
  const isPositive = (line.cp !== null && line.cp > 0) || (line.mate !== null && line.mate > 0);
  const isNegative = (line.cp !== null && line.cp < 0) || (line.mate !== null && line.mate < 0);

  const arrowMetas = useMemo(
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

  // Which move the user clicked on (null = show all arrows on base position)
  const [exploringIndex, setExploringIndex] = useState<number | null>(null);

  // Reset exploration when the line changes
  useEffect(() => {
    setExploringIndex(null);
  }, [fen, line.pvUci]);

  const handleMoveClick = useCallback((moveIdx: number) => {
    setExploringIndex((prev) => prev === moveIdx ? null : moveIdx);
  }, []);

  // Determine what to show on the board
  const boardFen = exploringIndex !== null && pvFens[exploringIndex]
    ? pvFens[exploringIndex]
    : fen;

  const showArrows = exploringIndex === null;

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
            arrows: showArrows ? arrowMetas.map((m) => m.arrow) : [],
            darkSquareStyle: { backgroundColor: '#4a6741' },
            lightSquareStyle: { backgroundColor: '#e8dcc8' },
            animationDurationInMs: 0,
            allowDragging: false,
            allowDrawingArrows: false,
          }}
        />
        {showArrows && (
          <div className={styles.arrowLabels}>
            {arrowMetas.map((meta) => {
              const pos = squareToPercent(meta.fromSquare);
              return (
                <span
                  key={meta.number}
                  className={styles.arrowLabel}
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    backgroundColor: meta.labelColor,
                  }}
                >
                  {meta.number}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.continuation}>
        {sanTokens.map((token) => {
          const isExploring = exploringIndex === token.moveIndex;
          return (
            <span
              key={token.moveIndex}
              className={`${styles.moveToken} ${isExploring ? styles.moveExploring : ''} ${token.isWhite ? styles.moveWhite : styles.moveBlack}`}
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
