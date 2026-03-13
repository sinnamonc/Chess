import { useState, useCallback } from 'react';
import type { AnalyzedGame, AnalyzedMove } from './types';
import { parsePgn } from './utils/pgnParser';
import { analyzeGame } from './engine/analyzer';
import Board from './components/Board/Board';
import MoveList from './components/MoveList/MoveList';
import InsightPanel from './components/InsightPanel/InsightPanel';
import PgnInput from './components/PgnInput/PgnInput';
import PositionMeter from './components/PositionMeter/PositionMeter';
import NavigationBar from './components/NavigationBar/NavigationBar';
import './App.css';

function App() {
  const [game, setGame] = useState<AnalyzedGame | null>(null);
  const [moveIndex, setMoveIndex] = useState(-1); // -1 = starting position
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePgnSubmit = useCallback((pgn: string) => {
    setError(null);
    setIsLoading(true);

    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      try {
        const parsed = parsePgn(pgn);

        if (parsed.moves.length === 0) {
          setError('No moves found in the PGN. Please check the format.');
          setIsLoading(false);
          return;
        }

        const analyzedMoves = analyzeGame(parsed);

        setGame({
          headers: parsed.headers,
          moves: analyzedMoves,
          startingFen: parsed.startingFen,
        });
        setMoveIndex(-1);
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
  const handleGoTo = useCallback((index: number) => setMoveIndex(index), []);

  const handleNewGame = useCallback(() => {
    setGame(null);
    setMoveIndex(-1);
    setError(null);
  }, []);

  // If no game loaded, show input screen
  if (!game) {
    return (
      <PgnInput onSubmit={handlePgnSubmit} error={error} isLoading={isLoading} />
    );
  }

  const currentMove: AnalyzedMove | null =
    moveIndex >= 0 ? game.moves[moveIndex] : null;
  const currentFen = currentMove ? currentMove.fen : game.startingFen;

  return (
    <div className="app">
      <header className="appHeader">
        <h1 className="appTitle">Chess Insight</h1>
        <button className="newGameBtn" onClick={handleNewGame}>
          New Game
        </button>
      </header>

      <main className="appMain">
        <div className="leftColumn">
          <Board
            fen={currentFen}
            arrows={currentMove?.arrows || []}
            highlights={currentMove?.highlights || []}
          />
          <PositionMeter feel={currentMove?.positionFeel || null} />
          <NavigationBar
            currentIndex={moveIndex}
            totalMoves={game.moves.length}
            onFirst={handleFirst}
            onPrev={handlePrev}
            onNext={handleNext}
            onLast={handleLast}
          />
        </div>

        <div className="rightColumn">
          <InsightPanel
            move={currentMove}
            moveIndex={moveIndex}
            totalMoves={game.moves.length}
            gameInfo={{
              white: game.headers.white,
              black: game.headers.black,
              event: game.headers.event,
              result: game.headers.result,
            }}
          />
          <MoveList
            moves={game.moves}
            currentIndex={moveIndex}
            onMoveClick={handleGoTo}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
