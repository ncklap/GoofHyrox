import { ACTIVITY_LABELS, LIFT_LABELS } from '../lib/constants.js';
import styles from './WorkoutLog.module.css';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function workoutLabel(w) {
  if (w.is_hyrox) {
    return `HYROX ${w.hyrox_length} (${w.hyrox_intensity})`;
  }
  if (w.is_lift) {
    return `${LIFT_LABELS[w.lift_id] || w.lift_id} (${w.heavy ? 'Heavy' : 'Light'})`;
  }
  const label = ACTIVITY_LABELS[w.activity_id] || w.activity_id;
  const unit = w.activity_id === 'wallball' ? 'reps' : 'm';
  return `${label} — ${w.value}${unit}${w.hard ? ' 🔥' : ''}`;
}

export default function WorkoutLog({ workouts, onDelete }) {
  if (workouts.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No workouts logged yet. Get after it.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      <h3 className={styles.heading}>Recent Workouts</h3>
      {workouts.slice(0, 20).map(w => (
        <div key={w.id} className={styles.item}>
          <div className={styles.info}>
            <span className={styles.label}>{workoutLabel(w)}</span>
            <span className={styles.time}>{formatDate(w.logged_at)}</span>
          </div>
          <button className={styles.deleteBtn} onClick={() => onDelete(w.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
