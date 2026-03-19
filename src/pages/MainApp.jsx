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
import MotivateMe from '../components/MotivateMe.jsx';
import Toast from '../components/Toast.jsx';
import styles from './MainApp.module.css';

function getInitials(name) {
  if (!name?.trim()) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function MainApp({ profile, onSignOut }) {
  const { workouts, addWorkout, deleteWorkout } = useWorkouts(profile?.id);
  const [showWorkout, setShowWorkout] = useState(false);
  const [showLift, setShowLift] = useState(false);
  const [showHyrox, setShowHyrox] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const scores = useMemo(() => computeScores(workouts), [workouts]);
  const verdict = useMemo(
    () => getVerdict(scores.total, workouts.length > 0),
    [scores.total, workouts.length]
  );
  const daysLeft = getDaysUntilRace(profile?.race_date);
  const showCapWarning = scores.coreZeros >= 1;

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
      <ReadinessMeter
        score={scores.total}
        hasWorkouts={workouts.length > 0}
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
            />
          ))}
        </div>
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

      <section className={styles.section}>
        <WorkoutLog workouts={workouts} onDelete={handleDelete} />
      </section>

      <section className={`${styles.section} ${styles.ctaSection}`}>
        <MotivateMe />
      </section>

      <nav className={styles.nav}>
        <Link to="/app" className={`${styles.navLink} ${styles.active}`}>Home</Link>
        <Link to="/leaderboard" className={styles.navLink}>Board</Link>
        <Link to="/profile" className={styles.navLink}>Profile</Link>
        <button type="button" className={styles.navLink} onClick={onSignOut}>Out</button>
      </nav>

      <LogWorkoutSheet
        open={showWorkout}
        onClose={() => setShowWorkout(false)}
        onLog={handleLog}
        onOpenLift={openLiftAfterClose}
        onOpenHyrox={openHyroxAfterClose}
      />
      <LiftSheet open={showLift} onClose={() => setShowLift(false)} onLog={handleLog} />
      <HyroxSheet open={showHyrox} onClose={() => setShowHyrox(false)} onLog={handleLog} />
    </div>
  );
}
