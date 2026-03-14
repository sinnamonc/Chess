import type { EngineLine } from '../../types';
import VariationBoard from '../VariationBoard/VariationBoard';
import styles from './EngineLines.module.css';

interface EngineLinesProps {
  lines: EngineLine[] | undefined;
  fen: string;
}

export default function EngineLines({ lines, fen }: EngineLinesProps) {
  if (!lines || lines.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>
          <div className={styles.spinner} />
          <span>Engine analysis pending...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {lines.map((line) => (
        <VariationBoard key={line.rank} fen={fen} line={line} />
      ))}
    </div>
  );
}
