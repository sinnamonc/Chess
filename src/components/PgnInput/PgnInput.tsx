import { useState } from 'react';
import styles from './PgnInput.module.css';

interface PgnInputProps {
  onSubmit: (pgn: string) => void;
  error: string | null;
  isLoading: boolean;
}

const PLACEHOLDER = `Paste a PGN here, for example:

[Event "Casual Game"]
[White "Player 1"]
[Black "Player 2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O *`;

export default function PgnInput({ onSubmit, error, isLoading }: PgnInputProps) {
  const [pgn, setPgn] = useState('');

  const handleSubmit = () => {
    if (pgn.trim()) {
      onSubmit(pgn.trim());
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Chess Insight</h1>
          <p className={styles.subtitle}>
            Paste a PGN to get human-readable analysis of any chess game.
            No engine scores — just clear explanations, visual ideas, and position insights.
          </p>
        </div>

        <textarea
          className={styles.textarea}
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={14}
          spellCheck={false}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.button}
          onClick={handleSubmit}
          disabled={!pgn.trim() || isLoading}
        >
          {isLoading ? 'Analyzing...' : 'Analyze Game'}
        </button>

        <div className={styles.hints}>
          <p>You can get PGNs from Lichess, Chess.com, or any chess database.</p>
        </div>
      </div>
    </div>
  );
}
