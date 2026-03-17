import { useState } from 'react';
import type { StrategicIdea } from '../../engine/strategicPlans';
import styles from './StrategicIdeas.module.css';

interface StrategicIdeasProps {
  ideas: StrategicIdea[];
  /** Called when the user hovers/selects an idea, to highlight on the board */
  onHighlight: (idea: StrategicIdea | null) => void;
}

const IDEA_ICONS: Record<string, string> = {
  'Push Passed Pawn': '\u265F',
  'Blockade Passed Pawn': '\u2715',
  'Attack the King': '\u2694',
  'Shore Up King Safety': '\u2657',
  'Contest Open File': '\u2656',
  'Occupy Outpost': '\u2658',
  'Pawn Break': '\u26A1',
  'Reposition Rook': '\u2656',
  'Improve Piece Activity': '\u2B06',
};

export default function StrategicIdeas({ ideas, onHighlight }: StrategicIdeasProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (ideas.length === 0) {
    return null;
  }

  const handleClick = (idx: number) => {
    if (activeIndex === idx) {
      setActiveIndex(null);
      onHighlight(null);
    } else {
      setActiveIndex(idx);
      onHighlight(ideas[idx]);
    }
  };

  const handleMouseEnter = (idx: number) => {
    if (activeIndex === null) {
      onHighlight(ideas[idx]);
    }
  };

  const handleMouseLeave = () => {
    if (activeIndex === null) {
      onHighlight(null);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Strategic Ideas</h2>
      <div className={styles.list}>
        {ideas.map((idea, idx) => (
          <button
            key={idx}
            className={`${styles.ideaCard} ${activeIndex === idx ? styles.active : ''}`}
            onClick={() => handleClick(idx)}
            onMouseEnter={() => handleMouseEnter(idx)}
            onMouseLeave={handleMouseLeave}
          >
            <span className={styles.icon}>{IDEA_ICONS[idea.title] || '\u2606'}</span>
            <div className={styles.ideaText}>
              <span className={styles.ideaTitle}>{idea.title}</span>
              <span className={styles.ideaDesc}>{idea.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
