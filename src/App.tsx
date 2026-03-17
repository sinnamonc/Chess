import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { AnalyzedGame, AnalyzedMove } from './types';
import { parsePgn } from './utils/pgnParser';
import { analyzeGame } from './engine/analyzer';
import { evaluateMoveProgressive, prefetchMoves } from './engine/stockfishAnalyzer';
import { getStockfishPool } from './engine/stockfishPool';
import { identifyOpening } from './utils/openings';
import { analyzePosition } from './engine/analyzer';
import { detectStrategicIdeas, type StrategicIdea } from './engine/strategicPlans';
import Board from './components/Board/Board';
import PgnInput from './components/PgnInput/PgnInput';
import PositionMeter from './components/PositionMeter/PositionMeter';
import NavigationBar from './components/NavigationBar/NavigationBar';
import EngineLines from './components/EngineLines/EngineLines';
import StrategicIdeas from './components/StrategicIdeas/StrategicIdeas';
import './App.css';

function App() {
  const [game, setGame] = useState<AnalyzedGame | null>(null);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [engineDepth, setEngineDepth] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const handlePgnSubmit = useCallback((pgn: string) => {
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      try {
        const parsed = parsePgn(pgn);

        if (parsed.moves.length === 0) {
          setError('No moves found in the PGN. Please check the format.');
          setIsLoading(false);
          return;
        }

        // Clear pool state from any previous game
        getStockfishPool().clearQueue();
        getStockfishPool().clearCache();

        const analyzedMoves = analyzeGame(parsed);
        setGame({
          headers: parsed.headers,
          moves: analyzedMoves,
          startingFen: parsed.startingFen,
        });
        setMoveIndex(-1);
        setEngineDepth(null);
        setIsLoading(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to parse PGN. Please check the format.'
        );
        setIsLoading(false);
      }
    }, 50);
  }, []);

  // Lazy evaluation: when moveIndex changes, evaluate that position on demand
  useEffect(() => {
    if (!game || moveIndex < 0) {
      setEngineDepth(null);
      return;
    }

    const move = game.moves[moveIndex];
    if (!move) return;

    // If already fully evaluated, skip
    if (move.engineLines && move.engineEval && (move.cpLoss !== undefined) && (move.engineLines[0]?.depth ?? 0) >= 16) {
      setEngineDepth(move.engineLines[0]?.depth ?? null);
      // Still prefetch neighbors
      prefetchMoves(game.moves, moveIndex);
      return;
    }

    // Abort any previous in-flight evaluation
    abortRef.current?.();
    setEngineDepth(null);

    const abort = evaluateMoveProgressive(
      move,
      // Quick callback (depth 10)
      (result) => {
        move.engineLines = result.engineLines;
        move.engineEval = result.engineEval;
        move.engineEvalBefore = result.engineEvalBefore;
        move.moveQuality = result.moveQuality;
        move.cpLoss = result.cpLoss;
        setEngineDepth(result.depth);
        // Trigger re-render
        setGame((g) => g ? { ...g, moves: [...g.moves] } : g);
      },
      // Full callback (depth 16)
      (result) => {
        move.engineLines = result.engineLines;
        move.engineEval = result.engineEval;
        move.engineEvalBefore = result.engineEvalBefore;
        move.moveQuality = result.moveQuality;
        move.cpLoss = result.cpLoss;
        setEngineDepth(result.depth);
        setGame((g) => g ? { ...g, moves: [...g.moves] } : g);

        // Prefetch neighbors after current position is done
        prefetchMoves(game.moves, moveIndex);
      },
    );

    abortRef.current = abort;

    return () => {
      abort();
    };
  }, [game, moveIndex]);

  const handleFirst = useCallback(() => setMoveIndex(-1), []);
  const handlePrev = useCallback(
    () => setMoveIndex((i) => Math.max(-1, i - 1)),
    []
  );
  const handleNext = useCallback(
    () =>
      setMoveIndex((i) => (game ? Math.min(game.moves.length - 1, i + 1) : i)),
    [game]
  );
  const handleLast = useCallback(
    () => setMoveIndex(game ? game.moves.length - 1 : -1),
    [game]
  );

  const handleNewGame = useCallback(() => {
    abortRef.current?.();
    getStockfishPool().clearQueue();
    getStockfishPool().clearCache();
    setGame(null);
    setMoveIndex(-1);
    setError(null);
    setEngineDepth(null);
  }, []);

  // Opening recognition: match against moves up to current index
  const opening = useMemo(() => {
    if (!game || moveIndex < 0) return null;
    const sanMoves = game.moves.slice(0, moveIndex + 1).map((m) => m.san);
    return identifyOpening(sanMoves);
  }, [game, moveIndex]);

  // Strategic ideas for the current position
  const strategicIdeas = useMemo(() => {
    if (!game || moveIndex < 0) return [];
    const move = game.moves[moveIndex];
    if (!move) return [];
    const posAnalysis = analyzePosition(move.fen);
    return detectStrategicIdeas(move.fen, posAnalysis, move.engineLines);
  }, [game, moveIndex, engineDepth]); // re-run when engine lines arrive

  const [highlightedIdea, setHighlightedIdea] = useState<StrategicIdea | null>(null);

  // Clear idea highlight when navigating
  useEffect(() => {
    setHighlightedIdea(null);
  }, [moveIndex]);

  if (!game) {
    return (
      <PgnInput onSubmit={handlePgnSubmit} error={error} isLoading={isLoading} />
    );
  }

  const currentMove: AnalyzedMove | null =
    moveIndex >= 0 ? game.moves[moveIndex] : null;
  const currentFen = currentMove ? currentMove.fen : game.startingFen;
  const engineLinesFen = currentMove ? currentMove.fen : game.startingFen;

  const moveLabel = currentMove
    ? `${currentMove.moveNumber}.${currentMove.color === 'b' ? '..' : ''} ${currentMove.san}`
    : 'Starting position';

  const qualitySymbol: Record<string, string> = {
    brilliant: '!!', great: '!', good: '', inaccuracy: '?!', mistake: '?', blunder: '??',
  };
  const qualityClass: Record<string, string> = {
    brilliant: 'qualBrilliant', great: 'qualGreat', good: 'qualGood',
    inaccuracy: 'qualInaccuracy', mistake: 'qualMistake', blunder: 'qualBlunder',
  };

  return (
    <div className="app">
      <header className="appHeader">
        <h1 className="appTitle">Chess Insight</h1>
        <div className="headerCenter">
          <span className="gameInfo">
            {game.headers.white} vs {game.headers.black}
          </span>
          {opening && (
            <span className="openingInfo">
              <span className="openingEco">{opening.eco}</span> {opening.name}
            </span>
          )}
        </div>
        <div className="headerRight">
          {currentMove && engineDepth !== null && engineDepth < 16 && (
            <span className="engineStatus">
              Depth {engineDepth}...
            </span>
          )}
          {currentMove && engineDepth !== null && engineDepth >= 16 && (
            <span className="engineReady">
              Depth {engineDepth}
            </span>
          )}
          <button className="newGameBtn" onClick={handleNewGame}>
            New Game
          </button>
        </div>
      </header>

      <main className="appMain">
        <div className="boardSection">
          <div className="boardRow">
            <Board
              fen={currentFen}
              arrows={currentMove?.arrows || []}
              highlights={currentMove?.highlights || []}
              overlayArrows={highlightedIdea?.arrows}
              overlaySquares={highlightedIdea?.squares}
            />
            <div className="boardInfo">
              <PositionMeter
                engineEval={currentMove?.engineEval || null}
              />
              <div className="moveLabel">
                <span className="moveSan">{moveLabel}</span>
                {currentMove?.moveQuality && qualitySymbol[currentMove.moveQuality] && (
                  <span className={`moveQuality ${qualityClass[currentMove.moveQuality]}`}>
                    {qualitySymbol[currentMove.moveQuality]}
                  </span>
                )}
              </div>
              <NavigationBar
                currentIndex={moveIndex}
                totalMoves={game.moves.length}
                onFirst={handleFirst}
                onPrev={handlePrev}
                onNext={handleNext}
                onLast={handleLast}
              />
              {strategicIdeas.length > 0 && (
                <StrategicIdeas
                  ideas={strategicIdeas}
                  onHighlight={setHighlightedIdea}
                />
              )}
            </div>
          </div>
        </div>

        <div className="linesSection">
          <h2 className="linesSectionTitle">Engine Lines</h2>
          <EngineLines
            lines={currentMove?.engineLines}
            fen={engineLinesFen}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
