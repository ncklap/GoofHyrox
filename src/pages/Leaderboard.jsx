import { Link } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useLeaderboard.js';
import { getDaysUntilRace } from '../lib/scoring.js';
import ReadinessMeter from '../components/ReadinessMeter.jsx';
import styles from './Leaderboard.module.css';

const VERDICT_CLASS = {
  onboarding: styles.vOnboarding,
  notReady: styles.vNotReady,
  orange: styles.vOrange,
  yellow: styles.vYellow,
  ready: styles.vReady,
  crush: styles.vCrush,
  elite: styles.vElite,
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarBg(score) {
  if (score >= 330) return 'var(--accent-green)';
  if (score >= 280) return 'var(--accent-yellow)';
  if (score >= 180) return 'var(--accent-orange)';
  if (score >= 90) return '#c93d52';
  return 'var(--accent-red)';
}

export default function Leaderboard({ currentUserId }) {
  const { entries, loading } = useLeaderboard();

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading leaderboard…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.appName}>HYROX READY</span>
        <Link to="/app" className={styles.backLink}>← Back</Link>
      </header>

      <h2 className="hyrox-section-label">Leaderboard</h2>

      <div className={styles.list}>
        {entries.map((entry, idx) => {
          const isCurrent = entry.profile.id === currentUserId;
          const daysLeft = getDaysUntilRace(entry.profile.race_date);
          const vClass = VERDICT_CLASS[entry.verdict.tone] || styles.vNotReady;

          return (
            <div
              key={entry.profile.id}
              className={`${styles.row} ${isCurrent ? styles.currentRow : ''}`}
            >
              <div className={styles.leftCol}>
                <span className={styles.rank}>#{idx + 1}</span>
                <div
                  className={styles.avatar}
                  style={{ background: avatarBg(entry.scores.total) }}
                >
                  {getInitials(entry.profile.name)}
                </div>
              </div>
              <div className={styles.midCol}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{entry.profile.name}</span>
                  {isCurrent && <span className={styles.youPill}>you</span>}
                </div>
                <span className={`${styles.verdict} ${vClass}`}>
                  {entry.verdict.label}
                </span>
                <ReadinessMeter
                  score={entry.scores.total}
                  compact
                  hasWorkouts={entry.workoutCount > 0}
                />
              </div>
              <div className={styles.rightCol}>
                <span className={styles.pct}>{entry.workoutCount} workouts</span>
                {daysLeft !== null && (
                  <span className={styles.days}>{daysLeft}d to race</span>
                )}
              </div>
            </div>
          );
        })}

        {entries.length === 0 && (
          <p className={styles.empty}>No one on the board yet. Be the first.</p>
        )}
      </div>

      <nav className={styles.nav}>
        <Link to="/app" className={styles.navLink}>Home</Link>
        <Link to="/progress" className={styles.navLink}>Progress</Link>
        <Link to="/leaderboard" className={`${styles.navLink} ${styles.active}`}>Board</Link>
        <Link to="/profile" className={styles.navLink}>Profile</Link>
      </nav>
    </div>
  );
}
