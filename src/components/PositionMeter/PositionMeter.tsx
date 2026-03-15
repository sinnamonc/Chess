import type { EngineEvaluation } from '../../types';
import styles from './PositionMeter.module.css';

interface PositionMeterProps {
  engineEval: EngineEvaluation | null;
}

/** Format eval for display: "+1.2", "-0.5", "M3", "M-3" */
function formatEval(ev: EngineEvaluation): string {
  if (ev.mate !== null) {
    return ev.mate > 0 ? `M${ev.mate}` : `M${ev.mate}`;
  }
  if (ev.cp === null) return '0.0';
  const val = ev.cp / 100;
  return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
}

/** Convert eval to a white percentage for the eval bar (0-100) */
function evalToWhitePercent(ev: EngineEvaluation): number {
  if (ev.mate !== null) {
    return ev.mate > 0 ? 95 : 5;
  }
  const cp = ev.cp ?? 0;
  // Use a sigmoid-like mapping: ±500cp maps to roughly 10%-90%
  const pct = 50 + 50 * (2 / (1 + Math.exp(-cp / 250)) - 1);
  return Math.max(3, Math.min(97, pct));
}

/** Derive a human-readable position description from engine eval */
function evalToFeelLabel(ev: EngineEvaluation): string {
  if (ev.mate !== null) {
    return ev.mate > 0 ? 'White has a forced mate' : 'Black has a forced mate';
  }
  const cp = ev.cp ?? 0;
  const abs = Math.abs(cp);
  const side = cp > 0 ? 'White' : 'Black';

  if (abs <= 15) return 'Equal';
  if (abs <= 50) return `${side} has a slight edge`;
  if (abs <= 150) return `${side} has a clear advantage`;
  if (abs <= 300) return `${side} has a commanding advantage`;
  return `${side} is winning`;
}

export default function PositionMeter({ engineEval }: PositionMeterProps) {
  // If we have engine eval, show the eval bar
  if (engineEval) {
    const whitePct = evalToWhitePercent(engineEval);
    const evalStr = formatEval(engineEval);
    const isWhiteAdvantage = (engineEval.cp !== null && engineEval.cp > 0) ||
      (engineEval.mate !== null && engineEval.mate > 0);
    const feelLabel = evalToFeelLabel(engineEval);

    return (
      <div className={styles.evalContainer}>
        <div className={styles.evalBar}>
          <div
            className={styles.whiteBar}
            style={{ width: `${whitePct}%` }}
          />
          <div
            className={styles.blackBar}
            style={{ width: `${100 - whitePct}%` }}
          />
        </div>
        <div className={styles.evalInfo}>
          <span className={`${styles.evalScore} ${isWhiteAdvantage ? styles.evalWhite : styles.evalBlack}`}>
            {evalStr}
          </span>
          <span className={styles.feelLabel}>{feelLabel}</span>
        </div>
      </div>
    );
  }

  // Fallback: no eval yet
  return (
    <div className={`${styles.meter} ${styles.equal}`}>
      <span className={styles.label}>Starting Position</span>
    </div>
  );
}
