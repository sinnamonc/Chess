import type { PositionFeel, EngineEvaluation } from '../../types';
import styles from './PositionMeter.module.css';

interface PositionMeterProps {
  feel: PositionFeel | null;
  engineEval: EngineEvaluation | null;
}

const FEEL_CONFIG: Record<PositionFeel, { label: string; className: string }> = {
  'equal': { label: 'Equal', className: 'equal' },
  'roughly equal': { label: 'Roughly Equal', className: 'equal' },
  'slight edge white': { label: 'White has a slight edge', className: 'slightWhite' },
  'slight edge black': { label: 'Black has a slight edge', className: 'slightBlack' },
  'clear advantage white': { label: 'White has a clear advantage', className: 'clearWhite' },
  'clear advantage black': { label: 'Black has a clear advantage', className: 'clearBlack' },
  'white is winning': { label: 'White is winning', className: 'winningWhite' },
  'black is winning': { label: 'Black is winning', className: 'winningBlack' },
  'unclear — double-edged': { label: 'Sharp — anything can happen!', className: 'unclear' },
  'white has compensation': { label: 'White has compensation for the material', className: 'compWhite' },
  'black has compensation': { label: 'Black has compensation for the material', className: 'compBlack' },
};

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

export default function PositionMeter({ feel, engineEval }: PositionMeterProps) {
  // If we have engine eval, show the eval bar
  if (engineEval) {
    const whitePct = evalToWhitePercent(engineEval);
    const evalStr = formatEval(engineEval);
    const isWhiteAdvantage = (engineEval.cp !== null && engineEval.cp > 0) ||
      (engineEval.mate !== null && engineEval.mate > 0);

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
          {feel && <span className={styles.feelLabel}>{FEEL_CONFIG[feel].label}</span>}
        </div>
      </div>
    );
  }

  // Fallback: qualitative meter only
  if (!feel) {
    return (
      <div className={`${styles.meter} ${styles.equal}`}>
        <span className={styles.label}>Starting Position</span>
      </div>
    );
  }

  const config = FEEL_CONFIG[feel];

  return (
    <div className={`${styles.meter} ${styles[config.className]}`}>
      <span className={styles.label}>{config.label}</span>
    </div>
  );
}
