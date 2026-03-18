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

  const handleLog = useCallback(async (data) => {
    const { error } = await addWorkout(data);
    if (!error) {
      setToast({ visible: true, message: 'Workout logged!' });
    }
  }, [addWorkout]);

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

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.greeting}>Hey, {profile?.name || 'Athlete'}</span>
        </div>
        <div className={styles.headerRight}>
          {daysLeft !== null && (
            <span className={styles.daysChip}>{daysLeft}d to race</span>
          )}
        </div>
      </header>

      {/* Verdict */}
      <VerdictDisplay verdict={verdict} score={scores.total} />
      <ReadinessMeter score={scores.total} />

      {/* Categories */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Categories</h2>
        <div className={styles.catGrid}>
          {Object.keys(CATEGORIES).map(cat => (
            <CategoryCard key={cat} catId={cat} score={scores.categories[cat]} />
          ))}
        </div>
      </section>

      {/* Log buttons */}
      <section className={styles.section}>
        <div className={styles.logBtns}>
          <button className={styles.logBtn} onClick={() => setShowWorkout(true)}>
            + Workout
          </button>
          <button className={`${styles.logBtn} ${styles.logBtnAlt}`} onClick={() => setShowLift(true)}>
            + Lift
          </button>
          <button className={`${styles.logBtn} ${styles.logBtnHyrox}`} onClick={() => setShowHyrox(true)}>
            + HYROX
          </button>
        </div>
      </section>

      {/* Workout log */}
      <section className={styles.section}>
        <WorkoutLog workouts={workouts} onDelete={handleDelete} />
      </section>

      {/* Motivate */}
      <section className={styles.section}>
        <MotivateMe />
      </section>

      {/* Nav */}
      <nav className={styles.nav}>
        <Link to="/app" className={`${styles.navLink} ${styles.active}`}>Home</Link>
        <Link to="/leaderboard" className={styles.navLink}>Leaderboard</Link>
        <Link to="/profile" className={styles.navLink}>Profile</Link>
        <button className={styles.navLink} onClick={onSignOut}>Logout</button>
      </nav>

      {/* Sheets */}
      <LogWorkoutSheet open={showWorkout} onClose={() => setShowWorkout(false)} onLog={handleLog} />
      <LiftSheet open={showLift} onClose={() => setShowLift(false)} onLog={handleLog} />
      <HyroxSheet open={showHyrox} onClose={() => setShowHyrox(false)} onLog={handleLog} />
    </div>
  );
}
