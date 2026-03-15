import { useEffect, useCallback, useState, useRef } from 'react';
import styles from './NavigationBar.module.css';

interface NavigationBarProps {
  currentIndex: number;
  totalMoves: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

export default function NavigationBar({
  currentIndex,
  totalMoves,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: NavigationBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          onPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNext();
          break;
        case 'Home':
          e.preventDefault();
          onFirst();
          break;
        case 'End':
          e.preventDefault();
          onLast();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
      }
    },
    [onPrev, onNext, onFirst, onLast]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-play
  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        onNext();
      }, 2000);
    } else {
      if (playInterval.current) {
        clearInterval(playInterval.current);
        playInterval.current = null;
      }
    }
    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  }, [isPlaying, onNext]);

  // Stop autoplay at end
  useEffect(() => {
    if (currentIndex >= totalMoves - 1 && isPlaying) {
      setIsPlaying(false);
    }
  }, [currentIndex, totalMoves, isPlaying]);

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <button
          className={styles.navBtn}
          onClick={onFirst}
          disabled={currentIndex < 0}
          title="First move (Home)"
        >
          &laquo;
        </button>
        <button
          className={styles.navBtn}
          onClick={onPrev}
          disabled={currentIndex < 0}
          title="Previous move (←)"
        >
          &lsaquo;
        </button>
        <button
          className={`${styles.navBtn} ${styles.playBtn}`}
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={currentIndex >= totalMoves - 1}
          title="Auto-play (Space)"
        >
          {isPlaying ? '||' : '\u25B6'}
        </button>
        <button
          className={styles.navBtn}
          onClick={onNext}
          disabled={currentIndex >= totalMoves - 1}
          title="Next move (→)"
        >
          &rsaquo;
        </button>
        <button
          className={styles.navBtn}
          onClick={onLast}
          disabled={currentIndex >= totalMoves - 1}
          title="Last move (End)"
        >
          &raquo;
        </button>
      </div>

      <div className={styles.shortcuts}>
        <span>&#x2190;&#x2192; Navigate</span>
        <span>Space Auto-play</span>
        <span>Home/End Jump</span>
      </div>
    </div>
  );
}
