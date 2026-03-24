import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWorkouts } from '../hooks/useWorkouts.js';
import { computeScores, getVerdict, getDaysUntilRace } from '../lib/scoring.js';
import { CATEGORIES } from '../lib/constants.js';
import VerdictDisplay from '../components/VerdictDisplay.jsx';
import ReadinessMeter from '../components/ReadinessMeter.jsx';
import CategoryCard from '../components/CategoryCard.jsx';
import WorkoutLog from '../components/WorkoutLog.jsx';
import LogWorkoutSheet from '../components/LogWorkoutSheet.jsx';
import LiftSheet from '../components/LiftSheet.jsx';
import HyroxSheet from '../components/HyroxSheet.jsx';
import WorkoutDetailSheet from '../components/WorkoutDetailSheet.jsx';
import MotivateMe from '../components/MotivateMe.jsx';
import Toast from '../components/Toast.jsx';
import styles from './MainApp.module.css';

function getInitials(name) {
  if (!name?.trim()) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function toLocalDayKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computeDayStreak(workouts) {
  if (!Array.isArray(workouts) || workouts.length === 0) return 0;
  const workoutDays = new Set(workouts.map((w) => toLocalDayKey(w.logged_at)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const cursor = new Date(today);
  while (workoutDays.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeWorkoutDaysThisWeek(workouts) {
  if (!Array.isArray(workouts) || workouts.length === 0) return 0;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // Sunday start

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  const unique = new Set();
  for (const w of workouts) {
    const d = new Date(w.logged_at);
    if (d >= start && d < end) unique.add(toLocalDayKey(w.logged_at));
  }
  return unique.size;
}

export default function MainApp({ profile, onSignOut }) {
  const { workouts, addWorkout, deleteWorkout, updateWorkout } = useWorkouts(profile?.id);
  const weightUnit = profile?.weight_unit === 'lbs' ? 'lbs' : 'kg';
  const distanceUnit = profile?.distance_unit === 'miles' ? 'miles' : 'km';
  const [showWorkout, setShowWorkout] = useState(false);
  const [showLift, setShowLift] = useState(false);
  const [showHyrox, setShowHyrox] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const scores = useMemo(() => computeScores(workouts, { profile }), [workouts, profile]);
  const verdict = useMemo(
    () => getVerdict(scores.total, workouts.length > 0),
    [scores.total, workouts.length]
  );
  const daysLeft = getDaysUntilRace(profile?.race_date);
  const showCapWarning = scores.coreZeros >= 1;
  const dayStreak = useMemo(() => computeDayStreak(workouts), [workouts]);
  const workoutDaysThisWeek = useMemo(() => computeWorkoutDaysThisWeek(workouts), [workouts]);

  const handleLog = useCallback(async (data) => {
    const toastMsg = data.__toast;
    const { __toast, ...workout } = data;
    const { error } = await addWorkout(workout);
    if (!error) {
      setToast({
        visible: true,
        message: toastMsg || 'Workout logged ✓',
      });
    }
    if (error) {
      setToast({
        visible: true,
        message: error.message || 'Failed to log workout',
      });
    }
    return { error: error ?? null };
  }, [addWorkout]);

  const openLiftAfterClose = useCallback(() => {
    setTimeout(() => setShowLift(true), 280);
  }, []);
  const openHyroxAfterClose = useCallback(() => {
    setTimeout(() => setShowHyrox(true), 280);
  }, []);

  const handleDelete = useCallback(async (id) => {
    await deleteWorkout(id);
    setToast({ visible: true, message: 'Workout deleted' });
  }, [deleteWorkout]);

  const handleUpdateWorkout = useCallback(
    async (workoutId, patch) => {
      const { data, error } = await updateWorkout(workoutId, patch);
      if (!error && data) setSelectedWorkout(data);
      setToast({
        visible: true,
        message: error ? (error.message || 'Update failed') : 'Workout updated ✓',
      });
      return { data, error };
    },
    [updateWorkout]
  );

  return (
    <div className={styles.page}>
      <Toast
        message={toast.message}
        visible={toast.visible}
        onHide={() => setToast({ visible: false, message: '' })}
      />

      <header className={styles.header}>
        <span className={styles.appName}>HYROX READY</span>
        <div className={styles.headerRight}>
          {daysLeft !== null && (
            (() => {
              const toneClass =
                daysLeft < 3
                  ? styles.daysChipBrightRed
                  : daysLeft < 7
                    ? styles.daysChipRed
                    : daysLeft < 14
                      ? styles.daysChipOrange
                      : daysLeft < 21
                        ? styles.daysChipYellow
                        : '';

              return (
                <span className={`${styles.daysChip} ${toneClass}`.trim()}>
                  <span className={styles.daysNum}>{daysLeft}</span>
                  <span className={styles.daysLabel}>
                    {daysLeft === 1 ? 'day left til race' : 'days left til race'}
                  </span>
                </span>
              );
            })()
          )}
          <div className={styles.profileStack}>
            <Link to="/profile" className={styles.avatar} aria-label="Profile">
              {getInitials(profile?.name)}
            </Link>
          </div>
        </div>
      </header>

      <VerdictDisplay verdict={verdict} />
      {dayStreak > 0 && (
        <div className={styles.streakRow}>
          <span className={styles.streakChip}>{dayStreak} day streak 🔥</span>
        </div>
      )}
      <ReadinessMeter
        score={scores.total}
        hasWorkouts={workouts.length > 0}
        statusText={verdict.subtext}
        statusTone={verdict.tone}
      />

      {showCapWarning && (
        <div className={styles.capWarning} role="status">
          You&apos;re missing core categories — total score is capped until you train them.
        </div>
      )}

      <section className={styles.section}>
        <h2 className="hyrox-section-label">Categories</h2>
        <div className={styles.catGrid}>
          {Object.keys(CATEGORIES).map(cat => (
            <CategoryCard
              key={cat}
              catId={cat}
              score={scores.categories[cat]}
              workouts={workouts}
              profile={profile}
            />
          ))}
        </div>
      </section>

      <div className={styles.logSection}>
        <section className={styles.section}>
          <WorkoutLog
            workouts={workouts}
            onDelete={handleDelete}
            onWorkoutClick={setSelectedWorkout}
            weightUnit={weightUnit}
            distanceUnit={distanceUnit}
            profile={profile}
          />
        </section>
        <section className={`${styles.section} ${styles.ctaSection}`}>
          <button
            type="button"
            className={styles.primaryCta}
            onClick={() => setShowWorkout(true)}
          >
            Log workout
          </button>
        </section>
      </div>

      <section className={`${styles.section} ${styles.ctaSection}`}>
        <MotivateMe />
        <button
          type="button"
          className={styles.viewAllWorkoutsLink}
          onClick={() => window.dispatchEvent(new CustomEvent('open-training-calendar'))}
        >
          View all workouts
        </button>
        <p className={styles.weekCounter}>
          {workoutDaysThisWeek} / 7 days worked out this week
        </p>
      </section>

      <nav className={styles.nav}>
        <Link to="/app" className={`${styles.navLink} ${styles.active}`}>Home</Link>
        <Link to="/progress" className={styles.navLink}>Progress</Link>
        <Link to="/leaderboard" className={styles.navLink}>Board</Link>
        <Link to="/profile" className={styles.navLink}>Profile</Link>
      </nav>

      <LogWorkoutSheet
        open={showWorkout}
        onClose={() => setShowWorkout(false)}
        onLog={handleLog}
        onOpenLift={openLiftAfterClose}
        onOpenHyrox={openHyroxAfterClose}
        distanceUnit={distanceUnit}
        profile={profile}
      />
      <LiftSheet
        open={showLift}
        onClose={() => setShowLift(false)}
        onLog={handleLog}
        weightUnit={weightUnit}
      />
      <HyroxSheet open={showHyrox} onClose={() => setShowHyrox(false)} onLog={handleLog} />
      <WorkoutDetailSheet
        open={!!selectedWorkout}
        workout={selectedWorkout}
        workouts={workouts}
        userId={profile?.id}
        onClose={() => setSelectedWorkout(null)}
        distanceUnit={distanceUnit}
        weightUnit={weightUnit}
        profile={profile}
        onUpdateWorkout={handleUpdateWorkout}
      />
    </div>
  );
}
