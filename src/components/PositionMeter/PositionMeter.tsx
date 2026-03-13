import type { PositionFeel } from '../../types';
import styles from './PositionMeter.module.css';

interface PositionMeterProps {
  feel: PositionFeel | null;
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

export default function PositionMeter({ feel }: PositionMeterProps) {
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
