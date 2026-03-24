import {
  CATEGORIES,
  ACTIVITIES,
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_TAGS,
} from '../lib/constants.js';
import { getWorkoutSessionPoints } from '../lib/scoring.js';
import styles from './CategoryCard.module.css';

function isRecentLogged(loggedAt) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15);
  return new Date(loggedAt) >= cutoff;
}

export default function CategoryCard({ catId, score, workouts = [], profile = null }) {
  const cat = CATEGORIES[catId];
  const pct = Math.min((score / cat.max) * 100, 100);
  const full = pct >= 99.5;
  const fillClass = full ? styles.fillFull : styles.fillPartial;

  // Tier pill based purely on filled percentage.
  // 0% -> NONE, 1-24 -> STARTER, 25-49 -> BUILDING, 50-74 -> SOLID, 75-99 -> STRONG, 100% -> MAXED
  let tier = 0;
  if (pct >= 100) tier = 5;
  else if (pct >= 75) tier = 4;
  else if (pct >= 50) tier = 3;
  else if (pct >= 25) tier = 2;
  else if (pct > 0) tier = 1;
  const tierLabels = ['NONE', 'STARTER', 'BUILDING', 'SOLID', 'STRONG', 'MAXED ✦'];
  const tierLabel = tierLabels[tier] ?? 'NONE';

  const stations = ACTIVITIES.filter(a => a.cat === catId);
  const recent = (workouts || []).filter(w => isRecentLogged(w.logged_at));

  const missingCore = cat.core && score === 0;
  const zeroScore = score === 0;

  return (
    <div
      className={`${styles.card} ${missingCore ? styles.missingCore : ''} ${zeroScore ? styles.zeroScore : ''}`}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon} aria-hidden>{CATEGORY_ICONS[catId]}</span>
          <div className={styles.titles}>
            <span className={styles.name}>{CATEGORY_LABELS[catId]}</span>
            <span className={styles.tag}>{CATEGORY_TAGS[catId]}</span>
          </div>
        </div>
        <span className={`${styles.tierPill} ${styles[`tier-${tier}`]}`}>
          {tierLabel}
        </span>
      </div>
      <div className={styles.track}>
        <div className={`${styles.fill} ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      {stations.length > 0 && (
        <div className={styles.pillsRow}>
          {stations.map(s => {
            const scored = recent.some(
              w =>
                !w.is_lift &&
                !w.is_hyrox &&
                w.activity_id === s.id &&
                getWorkoutSessionPoints(w, { profile }) > 0
            );
            return (
              <span
                key={s.id}
                className={`${styles.pill} ${scored ? styles.pillScored : ''}`}
              >
                {ACTIVITY_LABELS[s.id]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
