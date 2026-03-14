import { useState, useCallback } from 'react';
import type { AnalyzedGame, AnalyzedMove } from './types';
import { parsePgn } from './utils/pgnParser';
import { analyzeGame } from './engine/analyzer';
import { enrichWithStockfish, type AnalysisProgress } from './engine/stockfishAnalyzer';
import Board from './components/Board/Board';
import PgnInput from './components/PgnInput/PgnInput';
import PositionMeter from './components/PositionMeter/PositionMeter';
import NavigationBar from './components/NavigationBar/NavigationBar';
import EngineLines from './components/EngineLines/EngineLines';
import './App.css';

function App() {
  const [game, setGame] = useState<AnalyzedGame | null>(null);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [engineProgress, setEngineProgress] = useState<AnalysisProgress | null>(null);

  const handlePgnSubmit = useCallback((pgn: string) => {
    setError(null);
    setIsLoading(true);
    setEngineProgress(null);

    setTimeout(async () => {
      try {
        const parsed = parsePgn(pgn);

        if (parsed.moves.length === 0) {
          setError('No moves found in the PGN. Please check the format.');
          setIsLoading(false);
          return;
        }

        const analyzedMoves = analyzeGame(parsed);
        const analyzedGame: AnalyzedGame = {
          headers: parsed.headers,
          moves: analyzedMoves,
          startingFen: parsed.startingFen,
        };

        setGame(analyzedGame);
        setMoveIndex(-1);
        setIsLoading(false);

        // Stockfish enrichment in background
        setEngineProgress({ current: 0, total: analyzedMoves.length + 1, phase: 'engine' });

        try {
          await enrichWithStockfish(analyzedMoves, parsed.startingFen, (progress) => {
            setEngineProgress({ ...progress });
          });

          setGame({
            headers: parsed.headers,
            moves: [...analyzedMoves],
            startingFen: parsed.startingFen,
          });
        } catch (engineErr) {
          console.warn('Stockfish analysis failed:', engineErr);
        }

        setEngineProgress(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to parse PGN. Please check the format.'
        );
        setIsLoading(false);
        setEngineProgress(null);
      }
    }, 50);
  }, []);

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
    setGame(null);
    setMoveIndex(-1);
    setError(null);
    setEngineProgress(null);
  }, []);

  if (!game) {
    return (
      <PgnInput onSubmit={handlePgnSubmit} error={error} isLoading={isLoading} />
    );
  }

  const currentMove: AnalyzedMove | null =
    moveIndex >= 0 ? game.moves[moveIndex] : null;
  const currentFen = currentMove ? currentMove.fen : game.startingFen;

  // For engine lines, use the position BEFORE the current move (what the player faced)
  const engineLinesFen = currentMove ? currentMove.fenBefore : game.startingFen;

  // Build the current move label
  const moveLabel = currentMove
    ? `${currentMove.moveNumber}.${currentMove.color === 'b' ? '..' : ''} ${currentMove.san}`
    : 'Starting position';

  // Move quality badge
  const qualitySymbol: Record<string, string> = {
    brilliant: '!!',
    great: '!',
    good: '',
    inaccuracy: '?!',
    mistake: '?',
    blunder: '??',
  };
  const qualityClass: Record<string, string> = {
    brilliant: 'qualBrilliant',
    great: 'qualGreat',
    good: 'qualGood',
    inaccuracy: 'qualInaccuracy',
    mistake: 'qualMistake',
    blunder: 'qualBlunder',
  };

  return (
    <div className="app">
      <header className="appHeader">
        <h1 className="appTitle">Chess Insight</h1>
        <div className="headerCenter">
          <span className="gameInfo">
            {game.headers.white} vs {game.headers.black}
          </span>
        </div>
        <div className="headerRight">
          {engineProgress && (
            <span className="engineStatus">
              Analyzing {engineProgress.current}/{engineProgress.total}
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
            />
            <div className="boardInfo">
              <PositionMeter
                feel={currentMove?.positionFeel || null}
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
