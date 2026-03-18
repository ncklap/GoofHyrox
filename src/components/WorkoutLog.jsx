import { useState } from 'react';
import {
  ACTIVITY_LABELS,
  ACTIVITY_ICONS,
  LIFT_LABELS,
  LIFT_ICONS,
} from '../lib/constants.js';
import { getWorkoutSessionPoints } from '../lib/scoring.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import styles from './WorkoutLog.module.css';

function isRecent(loggedAt) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15);
  return new Date(loggedAt) >= cutoff;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';

  const now = new Date();
  const diffMs = now - d;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function workoutIcon(w) {
  if (w.is_hyrox) return '🏁';
  if (w.is_lift) return LIFT_ICONS[w.lift_id] || '🏋️';
  return ACTIVITY_ICONS[w.activity_id] || '•';
}

function workoutTitle(w) {
  if (w.is_hyrox) {
    const len = w.hyrox_length === 'full' ? 'Full' : w.hyrox_length === 'half' ? 'Half' : 'Quarter';
    const feel = w.hyrox_intensity === 'hard' ? 'Hard' : 'Easy';
    return `Hyrox ${len} · ${feel}`;
  }
  if (w.is_lift) {
    const load = w.heavy ? 'Heavy' : 'Light';
    return `${LIFT_LABELS[w.lift_id] || w.lift_id} · ${load}`;
  }
  const label = ACTIVITY_LABELS[w.activity_id] || w.activity_id;
  const unit = w.activity_id === 'wallball' ? 'reps' : w.activity_id === 'run' ? 'km' : 'm';
  const valueDisplay = w.activity_id === 'run' ? formatKmFromMeters(w.value) : w.value;
  const feel = w.hard ? 'Hard' : 'Easy';
  return `${label} · ${valueDisplay}${unit} · ${feel}`;
}

function liftTrackingMeta(w) {
  if (!w?.is_lift) return null;

  const parts = [];

  const weightNum = w.lift_weight_kg !== null && w.lift_weight_kg !== undefined && w.lift_weight_kg !== ''
    ? Number(w.lift_weight_kg)
    : null;
  if (weightNum !== null && Number.isFinite(weightNum)) {
    parts.push(`${Math.round(weightNum)}kg`);
  }

  const setsNum = w.lift_sets !== null && w.lift_sets !== undefined && w.lift_sets !== ''
    ? Number(w.lift_sets)
    : null;
  const repsNum = w.lift_reps !== null && w.lift_reps !== undefined && w.lift_reps !== ''
    ? Number(w.lift_reps)
    : null;

  if (setsNum !== null && Number.isFinite(setsNum) && repsNum !== null && Number.isFinite(repsNum)) {
    parts.push(`${Math.round(setsNum)}×${Math.round(repsNum)}`);
  } else if (setsNum !== null && Number.isFinite(setsNum)) {
    parts.push(`${Math.round(setsNum)} sets`);
  } else if (repsNum !== null && Number.isFinite(repsNum)) {
    parts.push(`${Math.round(repsNum)} reps`);
  }

  if (parts.length === 0) return null;
  return parts.join(' · ');
}

function formatKmFromMeters(meters) {
  if (meters === null || meters === undefined || meters === '') return '';
  const n = Number(meters);
  if (!Number.isFinite(n)) return '';
  const km = n / 1000;
  // Display either whole km or one decimal place.
  const rounded1 = Math.round(km * 10) / 10;
  return rounded1 % 1 === 0 ? String(Math.round(rounded1)) : String(rounded1);
}

export default function WorkoutLog({ workouts, onDelete }) {
  const [pendingId, setPendingId] = useState(null);

  if (workouts.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No workouts logged yet. Get after it.</p>
      </div>
    );
  }

  const pendingWorkout = pendingId ? workouts.find(w => w.id === pendingId) : null;
  const visibleWorkouts = workouts.slice(0, 20);
  const scoredVisible = visibleWorkouts.map(w => {
    const recent = isRecent(w.logged_at);
    const pts = getWorkoutSessionPoints(w);
    return { w, recent, pts };
  });
  // Scale bars against the highest-scoring workout currently visible in this list.
  const maxPts = Math.max(0, ...scoredVisible.map(x => x.pts));

  return (
    <div className={styles.wrap}>
      <h3 className="hyrox-section-label">Recent workouts</h3>
      <div className={styles.list}>
        {scoredVisible.map(({ w, recent, pts }) => {
          const ratio = maxPts > 0 ? pts / maxPts : 0;
          const pct = Math.min(ratio * 100, 100);
          let impact = 'LOW IMPACT';
          let impactLevel = 0;
          if (!recent) {
            impact = 'EXPIRED';
            impactLevel = -1;
          } else if (pct < 25) {
            impact = 'LOW IMPACT';
            impactLevel = 0;
          } else if (pct < 50) {
            impact = 'DECENT';
            impactLevel = 1;
          } else if (pct < 75) {
            impact = 'HIGH IMPACT';
            impactLevel = 2;
          } else {
            impact = 'BIG IMPACT';
            impactLevel = 3;
          }

          return (
            <div
              key={w.id}
              className={`${styles.item} ${!recent ? styles.expired : ''}`}
            >
              <div className={styles.left}>
                <span className={styles.emoji} aria-hidden>{workoutIcon(w)}</span>
                <div className={styles.textCol}>
                  <span className={styles.name}>{workoutTitle(w)}</span>
                  {w.is_lift && (
                    <span className={styles.meta}>
                      {liftTrackingMeta(w)}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.right}>
                {recent ? (
                  <div className={styles.impactWrap}>
                    <div className={styles.impactTrack}>
                      <div
                        className={`${styles.impactFill} ${styles[`impactFill${impactLevel}`]}`}
                        style={{ width: `${Math.round(pct)}%` }}
                      />
                    </div>
                    <span className={`${styles.impactLabel} ${styles[`impactLabel${impactLevel}`]}`}>
                      {impact}
                    </span>
                  </div>
                ) : (
                  <span className={styles.expiredImpact}>EXPIRED</span>
                )}
                <span className={styles.date}>{formatDate(w.logged_at)}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label="Delete workout"
                  onClick={() => setPendingId(w.id)}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!pendingId}
        title="Delete workout?"
        message={
          pendingWorkout
            ? `Remove this log entry?`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setPendingId(null)}
        onConfirm={() => {
          if (pendingId) onDelete(pendingId);
          setPendingId(null);
        }}
      />
    </div>
  );
}
