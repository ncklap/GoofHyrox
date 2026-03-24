import { useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import {
  ACTIVITY_LABELS,
  LIFT_LABELS,
  LEGACY_ERG_METERS_THRESHOLD,
  LABEL_INTENSITY_CHALLENGING,
  LABEL_INTENSITY_COMFORTABLE,
} from '../lib/constants.js';
import styles from './TrainingCalendarSheet.module.css';

function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDateKeyFromTs(ts) {
  const d = new Date(ts);
  return dayKey(d);
}

function monthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWorkoutKind(w) {
  if (w.is_lift) return 'strength';
  return 'cardio';
}

function workoutName(w) {
  if (w.is_lift) return LIFT_LABELS[w.lift_id] || 'Lift';
  if (w.is_hyrox) return 'Hyrox Workout';
  return ACTIVITY_LABELS[w.activity_id] || 'Workout';
}

function formatRunDistance(meters, distanceUnit) {
  if (meters === null || meters === undefined || meters === '') return '';
  const n = Number(meters);
  if (!Number.isFinite(n)) return '';
  const base = distanceUnit === 'miles' ? (n / 1609.344) : (n / 1000);
  const rounded1 = Math.round(base * 10) / 10;
  return rounded1 % 1 === 0 ? String(Math.round(rounded1)) : String(rounded1);
}

function formatDuration(totalSeconds) {
  const n = Number(totalSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function workoutDetail(w, distanceUnit) {
  if (w.is_lift) {
    return w.heavy ? 'Heavy' : 'Light';
  }
  if (w.is_hyrox) {
    const len = w.hyrox_length === 'full' ? 'Full' : w.hyrox_length === 'half' ? 'Half' : 'Quarter';
    const intensity = w.hyrox_intensity === 'hard' ? LABEL_INTENSITY_CHALLENGING : LABEL_INTENSITY_COMFORTABLE;
    return `${len} · ${intensity}`;
  }

  const intensity = w.hard ? LABEL_INTENSITY_CHALLENGING : LABEL_INTENSITY_COMFORTABLE;
  const bits = [];

  if (Number.isFinite(Number(w.distance_km)) && Number(w.distance_km) > 0) {
    const meters = Number(w.distance_km) * 1000;
    bits.push(`${formatRunDistance(meters, distanceUnit)}${distanceUnit === 'miles' ? 'mi' : 'km'}`);
  } else if (Number.isFinite(Number(w.distance_m)) && Number(w.distance_m) > 0) {
    bits.push(`${Math.round(Number(w.distance_m))}m`);
  } else if (w.activity_id === 'skierg' || w.activity_id === 'rowing') {
    const v = Number(w.value);
    if (Number.isFinite(v) && v > 0 && v < LEGACY_ERG_METERS_THRESHOLD) {
      bits.push(`${formatDuration(v)}/500m`);
    } else {
      bits.push(`${w.value ?? ''}m`);
    }
  } else {
    const valueDisplay = w.activity_id === 'run'
      ? formatRunDistance(w.value, distanceUnit)
      : String(w.value ?? '');
    const unit = w.activity_id === 'run'
      ? (distanceUnit === 'miles' ? 'mi' : 'km')
      : w.activity_id === 'wallball'
        ? 'reps'
        : 'm';
    bits.push(`${valueDisplay}${unit}`);
  }

  const duration = formatDuration(w.duration_seconds);
  if (duration) bits.push(duration);

  if (Number.isFinite(Number(w.pace_per_unit)) && Number(w.pace_per_unit) > 0) {
    const totalSec = Math.round(Number(w.pace_per_unit) * 60);
    const pm = Math.floor(totalSec / 60);
    const ps = totalSec % 60;
    const paceUnit = w.activity_id === 'run' ? (distanceUnit === 'miles' ? 'mi' : 'km') : 'm';
    bits.push(`${pm}:${String(ps).padStart(2, '0')}/${paceUnit}`);
  }

  if (Number.isFinite(Number(w.station_weight_lbs)) && Number(w.station_weight_lbs) > 0) {
    bits.push(`${Math.round(Number(w.station_weight_lbs))}lbs`);
  }
  if (Number.isFinite(Number(w.station_reps)) && Number(w.station_reps) > 0) {
    bits.push(`${Math.round(Number(w.station_reps))} reps`);
  }

  bits.push(intensity);
  return bits.join(' · ');
}

export default function TrainingCalendarSheet({
  open,
  onClose,
  workouts,
  distanceUnit = 'km',
}) {
  const [viewMonth, setViewMonth] = useState(() => monthStart(new Date()));
  const [popup, setPopup] = useState(null);
  const popupTimerRef = useRef(null);
  const gridRef = useRef(null);

  const todayMonth = monthStart(new Date());
  const isCurrentMonth = monthKey(viewMonth) === monthKey(todayMonth);

  useEffect(() => {
    if (!open) return;
    setViewMonth(monthStart(new Date()));
    setPopup(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  const workoutsByDay = useMemo(() => {
    const map = new Map();
    for (const w of workouts || []) {
      if (!w?.logged_at) continue;
      const key = toDateKeyFromTs(w.logged_at);
      const arr = map.get(key) || [];
      arr.push(w);
      map.set(key, arr);
    }
    return map;
  }, [workouts]);

  const monthCells = useMemo(() => {
    const first = monthStart(viewMonth);
    const y = first.getFullYear();
    const m = first.getMonth();
    const firstWeekday = first.getDay(); // 0 = Sun
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ blank: true, key: `blank-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(y, m, d);
      const key = dayKey(date);
      const dayWorkouts = workoutsByDay.get(key) || [];
      const hasCardio = dayWorkouts.some(w => getWorkoutKind(w) === 'cardio');
      const hasStrength = dayWorkouts.some(w => getWorkoutKind(w) === 'strength');
      cells.push({
        blank: false,
        key,
        day: d,
        workouts: dayWorkouts,
        hasCardio,
        hasStrength,
      });
    }
    return cells;
  }, [viewMonth, workoutsByDay]);

  const closePopup = () => {
    setPopup(null);
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  };

  const openDayPopup = (e, cell) => {
    if (!cell.workouts.length) return;
    const btnRect = e.currentTarget.getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;

    const left = Math.max(8, Math.min(btnRect.left - gridRect.left, gridRect.width - 220));
    const top = Math.max(8, btnRect.bottom - gridRect.top + 6);
    setPopup({
      dayKey: cell.key,
      left,
      top,
      workouts: cell.workouts,
    });

    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      setPopup(null);
      popupTimerRef.current = null;
    }, 3000);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        closePopup();
        onClose();
      }}
      title="Training Calendar"
      scrollContent
    >
      <div
        className={styles.calendarWrap}
        onClick={(e) => {
          if (e.target.closest('[data-day-cell]')) return;
          if (e.target.closest('[data-day-popup]')) return;
          closePopup();
        }}
      >
        <div className={styles.monthNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            ←
          </button>
          <p className={styles.monthLabel}>{monthLabel(viewMonth)}</p>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => {
              if (isCurrentMonth) return;
              setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
            }}
            aria-label="Next month"
            disabled={isCurrentMonth}
          >
            →
          </button>
        </div>

        <div className={styles.weekdays}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <span key={d} className={styles.weekday}>{d}</span>
          ))}
        </div>

        <div className={styles.grid} ref={gridRef}>
          {monthCells.map(cell => {
            if (cell.blank) return <div key={cell.key} className={styles.blankCell} />;

            const hasAny = cell.workouts.length > 0;
            return (
              <button
                key={cell.key}
                type="button"
                data-day-cell
                className={`${styles.dayCell} ${hasAny ? styles.dayActive : ''}`}
                onClick={(e) => openDayPopup(e, cell)}
              >
                {hasAny ? (
                  <>
                    <div className={styles.emojiSlot}>
                      {cell.hasCardio && <span className={styles.emojiCardio}>🏃</span>}
                      {cell.hasStrength && <span className={styles.emojiStrength}>💪</span>}
                    </div>
                    <span className={styles.dayNumSmall}>{cell.day}</span>
                  </>
                ) : (
                  <span className={styles.dayNum}>{cell.day}</span>
                )}
              </button>
            );
          })}

          {popup && (
            <div
              data-day-popup
              className={styles.popup}
              style={{ left: popup.left, top: popup.top }}
            >
              {popup.workouts.map((w) => (
                <div key={w.id} className={styles.popupRow}>
                  <span className={styles.popupName}>{workoutName(w)}</span>
                  <span className={styles.popupDetail}>{workoutDetail(w, distanceUnit)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendEmoji}>🏃</span>
            Cardio / Station
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendEmoji}>💪</span>
            Strength / Lift
          </span>
        </div>
      </div>
    </BottomSheet>
  );
}

