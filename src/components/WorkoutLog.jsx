import { useEffect, useMemo, useRef, useState } from 'react';
import { getWorkoutSessionPoints } from '../lib/scoring.js';
import {
  formatDate,
  workoutIcon,
  workoutTitle,
  liftTrackingMeta,
} from '../lib/workoutFormatters.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import TrainingCalendarSheet from './TrainingCalendarSheet.jsx';
import styles from './WorkoutLog.module.css';

function isRecent(loggedAt) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15);
  return new Date(loggedAt) >= cutoff;
}

export default function WorkoutLog({
  workouts,
  onDelete,
  onWorkoutClick,
  weightUnit = 'kg',
  distanceUnit = 'km',
  profile = null,
}) {
  const TOP_OFFSET = 0;
  const SLOT = 79;
  const NEW_TOP = -74;
  const SLOT_5_TOP = TOP_OFFSET + 5 * SLOT;
  const SLOT_4_TOP = TOP_OFFSET + 4 * SLOT;
  const ITEM_HEIGHT_EST = 72;
  const ANIM_MS = 420;
  const BUFFER_MS = 60;
  const END_MS = ANIM_MS + BUFFER_MS;
  const FEED_TRANSITION = `top ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1)`;
  const PEEK_TRANSITION_BOTTOM = `bottom ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1), transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${ANIM_MS}ms ease`;

  const [pendingId, setPendingId] = useState(null);
  const [visibleWorkouts, setVisibleWorkouts] = useState(() => workouts.slice(0, 5));
  const [bottomStack, setBottomStack] = useState(() => workouts.slice(5, 8));
  const [incomingWorkout, setIncomingWorkout] = useState(null);
  const [animMode, setAnimMode] = useState(null); // TOP_ENTRY | BOTTOM_ENTRY
  const [animPhase, setAnimPhase] = useState('IDLE'); // IDLE | PRE | ACTIVE
  const [animTargetVisible, setAnimTargetVisible] = useState([]);
  const [animNextBottom, setAnimNextBottom] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const busyRef = useRef(false);
  const prevTopIdRef = useRef(workouts[0]?.id ?? null);
  const initializedRef = useRef(false);

  function impactFromPct(pct) {
    if (pct < 15) return { impact: 'MICRO INVESTMENT', impactLevel: 0 };
    if (pct < 25) return { impact: 'LIGHT DAY', impactLevel: 1 };
    if (pct < 50) return { impact: 'GOOD WORKOUT', impactLevel: 2 };
    if (pct < 65) return { impact: 'STRONG SESSION', impactLevel: 3 };
    if (pct < 75) return { impact: 'GREAT SESSION', impactLevel: 4 };
    return { impact: 'NEEDLE MOVER', impactLevel: 5 };
  }

  useEffect(() => {
    if (initializedRef.current) return;
    setVisibleWorkouts(workouts.slice(0, 5));
    setBottomStack(workouts.slice(5, 8));
    prevTopIdRef.current = workouts[0]?.id ?? null;
    initializedRef.current = true;
  }, [workouts]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (busyRef.current) return;

    const nextTopId = workouts[0]?.id ?? null;
    const prevTopId = prevTopIdRef.current;

    // New workout prepended: animate top entry and evict last into bottom stack.
    if (prevTopId && nextTopId && nextTopId !== prevTopId && workouts[0]) {
      const incoming = workouts[0];
      const prevVisible = visibleWorkouts;
      const prevBottom = bottomStack;
      if (prevVisible.length === 5) {
        const evicted = prevVisible[4];
        const nextVisible = [incoming, ...prevVisible.slice(0, 4)];
        const nextBottom = [evicted, ...prevBottom].slice(0, 3);
        beginTransition('TOP_ENTRY', incoming, nextVisible, nextBottom);
      } else {
        setVisibleWorkouts(workouts.slice(0, 5));
        setBottomStack(workouts.slice(5, 8));
      }
    } else {
      // General resync (delete/refresh) when not animating.
      setVisibleWorkouts(workouts.slice(0, 5));
      setBottomStack(workouts.slice(5, 8));
    }

    prevTopIdRef.current = nextTopId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts]);

  useEffect(() => {
    function handleOpenCalendar() {
      setShowCalendar(true);
    }
    window.addEventListener('open-training-calendar', handleOpenCalendar);
    return () => window.removeEventListener('open-training-calendar', handleOpenCalendar);
  }, []);

  const maxPts = useMemo(() => {
    const basis = animPhase === 'ACTIVE' ? animTargetVisible : visibleWorkouts;
    if (!basis.length) return 0;
    return Math.max(0, ...basis.map(w => getWorkoutSessionPoints(w, { profile })));
  }, [animPhase, animTargetVisible, visibleWorkouts, profile]);

  const pendingWorkout = pendingId ? workouts.find(w => w.id === pendingId) : null;
  const workoutsThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return (workouts || []).filter(w => {
      if (!w?.logged_at) return false;
      const d = new Date(w.logged_at);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [workouts]);

  function beginTransition(mode, incoming, nextVisible, nextBottom) {
    if (busyRef.current) return;
    busyRef.current = true;
    setAnimMode(mode);
    setIncomingWorkout(incoming);
    setAnimTargetVisible(nextVisible);
    setAnimNextBottom(nextBottom);
    setAnimPhase('PRE');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimPhase('ACTIVE');
      });
    });

    window.setTimeout(() => {
      setVisibleWorkouts(nextVisible);
      setBottomStack(nextBottom);
      setIncomingWorkout(null);
      setAnimMode(null);
      setAnimPhase('IDLE');
      setAnimTargetVisible([]);
      setAnimNextBottom([]);
      busyRef.current = false;
    }, END_MS);
  }

  function handleBottomStackClick() {
    if (busyRef.current) return;
    if (!bottomStack.length) return;
    if (visibleWorkouts.length < 5) return;

    const incoming = bottomStack[0];
    const evicted = visibleWorkouts[0];
    const nextVisible = [...visibleWorkouts.slice(1), incoming];
    const nextBottom = [...bottomStack.slice(1), evicted].slice(0, 3);
    beginTransition('BOTTOM_ENTRY', incoming, nextVisible, nextBottom);
  }

  const renderRow = (w, { disableDelete, allowExpiredDim, onRowClick, rowStyle }) => {
    const recent = isRecent(w.logged_at);

    const pts = getWorkoutSessionPoints(w, { profile });
    const ratio = maxPts > 0 ? pts / maxPts : 0;
    const pct = Math.min(ratio * 100, 100);

    let impact = 'MICRO INVESTMENT';
    let impactLevel = 0;
    if (!recent) {
      impact = 'EXPIRED';
      impactLevel = 0;
    } else {
      const r = impactFromPct(pct);
      impact = r.impact;
      impactLevel = r.impactLevel;
    }

    return (
      <div
        className={`${styles.item} ${!recent && allowExpiredDim ? styles.expired : ''}`}
        onClick={onRowClick}
        style={rowStyle}
      >
        <div className={styles.left}>
          <span className={styles.emoji} aria-hidden>{workoutIcon(w)}</span>
          <div className={styles.textCol}>
            <span className={styles.name}>{workoutTitle(w, distanceUnit)}</span>
            {w.is_lift && (
              <span className={styles.meta}>
                {liftTrackingMeta(w, weightUnit)}
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
            style={disableDelete ? { pointerEvents: 'none' } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (disableDelete) return;
              setPendingId(w.id);
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  if (workouts.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No workouts logged yet. Get after it.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h3 className="hyrox-section-label">Recent workouts</h3>
      <div
        style={{
          position: 'relative',
          height:
            animPhase === 'IDLE'
              ? TOP_OFFSET + Math.max(0, visibleWorkouts.length - 1) * SLOT + ITEM_HEIGHT_EST
              : SLOT_5_TOP + ITEM_HEIGHT_EST,
        }}
      >
        {visibleWorkouts.map((w, idx) => {
          const baseStyle = {
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 20 - idx,
          };

          let rowStyle = { ...baseStyle, top: TOP_OFFSET + idx * SLOT, transition: 'none' };

          if (animPhase === 'ACTIVE') {
            if (animMode === 'TOP_ENTRY') {
              if (idx === 4) {
                rowStyle = {
                  ...baseStyle,
                  top: SLOT_5_TOP,
                  opacity: 0,
                  transform: 'scale(0.95)',
                  transition: FEED_TRANSITION,
                };
              } else {
                rowStyle = {
                  ...baseStyle,
                  top: TOP_OFFSET + (idx + 1) * SLOT,
                  transition: FEED_TRANSITION,
                };
              }
            } else if (animMode === 'BOTTOM_ENTRY') {
              if (idx === 0) {
                rowStyle = {
                  ...baseStyle,
                  top: NEW_TOP,
                  opacity: 0,
                  transform: 'scale(0.96)',
                  transition: FEED_TRANSITION,
                };
              } else {
                rowStyle = {
                  ...baseStyle,
                  top: TOP_OFFSET + (idx - 1) * SLOT,
                  transition: FEED_TRANSITION,
                };
              }
            }
          }

          return (
            <div key={w.id}>
              {renderRow(w, {
                disableDelete: false,
                allowExpiredDim: true,
                onRowClick: () => onWorkoutClick?.(w),
                rowStyle,
              })}
            </div>
          );
        })}

        {incomingWorkout ? (
          renderRow(incomingWorkout, {
            disableDelete: true,
            allowExpiredDim: true,
            onRowClick: () => onWorkoutClick?.(incomingWorkout),
            rowStyle:
              animPhase !== 'ACTIVE'
                ? (animMode === 'TOP_ENTRY'
                  ? {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: NEW_TOP,
                    opacity: 0,
                    transform: 'scale(0.96)',
                    transition: 'none',
                    zIndex: 80,
                  }
                  : {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: SLOT_5_TOP,
                    opacity: 0,
                    transform: 'scale(0.95)',
                    transition: 'none',
                    zIndex: 80,
                  })
                : (animMode === 'TOP_ENTRY'
                  ? {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: TOP_OFFSET,
                    opacity: 1,
                    transform: 'scale(1)',
                    transition: FEED_TRANSITION,
                    zIndex: 80,
                  }
                  : {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: SLOT_4_TOP,
                    opacity: 1,
                    transform: 'scale(1)',
                    transition: FEED_TRANSITION,
                    zIndex: 80,
                  }),
          })
        ) : null}

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 40,
            zIndex: 10,
            pointerEvents: bottomStack.length && !busyRef.current ? 'auto' : 'none',
          }}
          onClick={handleBottomStackClick}
        >
          {(animPhase === 'ACTIVE' ? animNextBottom : bottomStack).slice(0, 3).map((w, depth) => (
            <div
              key={w.id}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: depth * 5,
                transformOrigin: 'bottom center',
                transform: `scale(${1 - depth * 0.03})`,
                zIndex: 20 - depth,
                opacity: 1,
                backgroundColor: `rgb(${28 - depth * 5}, ${28 - depth * 5}, ${30 - depth * 5})`,
                transition: animPhase === 'ACTIVE' ? PEEK_TRANSITION_BOTTOM : 'none',
              }}
            >
              {renderRow(w, {
                disableDelete: true,
                allowExpiredDim: false,
                onRowClick: () => onWorkoutClick?.(w),
                rowStyle: undefined,
              })}
            </div>
          ))}
        </div>
      </div>

      {bottomStack.length > 0 && (
        <button
          type="button"
          className={styles.calendarCard}
          onClick={() => setShowCalendar(true)}
        >
          <span className={styles.calendarCardTitle}>{workoutsThisMonth} workouts this month</span>
          <span className={styles.calendarCardSub}>Click here for more</span>
        </button>
      )}

      <TrainingCalendarSheet
        open={showCalendar}
        onClose={() => setShowCalendar(false)}
        workouts={workouts}
        distanceUnit={distanceUnit}
      />

      <ConfirmDialog
        open={!!pendingId}
        title="Delete workout?"
        message={pendingWorkout ? 'Remove this log entry?' : ''}
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
