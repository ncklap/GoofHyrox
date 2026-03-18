import { CATEGORIES, ACTIVITIES, ACTIVITY_LABELS, CATEGORY_LABELS } from '../lib/constants.js';
import styles from './CategoryCard.module.css';

export default function CategoryCard({ catId, score }) {
  const cat = CATEGORIES[catId];
  const pct = Math.min((score / cat.max) * 100, 100);
  const stations = ACTIVITIES.filter(a => a.cat === catId);

  let barColor = 'var(--accent-red)';
  if (pct >= 80) barColor = 'var(--accent-green)';
  else if (pct >= 60) barColor = 'var(--accent-yellow)';
  else if (pct >= 40) barColor = 'var(--accent-orange)';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{CATEGORY_LABELS[catId]}</span>
        <span className={styles.score}>
          {Math.round(score)}<span className={styles.max}>/{cat.max}</span>
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      {stations.length > 0 && (
        <div className={styles.pills}>
          {stations.map(s => (
            <span key={s.id} className={styles.pill}>
              {ACTIVITY_LABELS[s.id]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
