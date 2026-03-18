import { Link } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useLeaderboard.js';
import { getDaysUntilRace } from '../lib/scoring.js';
import ReadinessMeter from '../components/ReadinessMeter.jsx';
import styles from './Leaderboard.module.css';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Leaderboard({ currentUserId }) {
  const { entries, loading } = useLeaderboard();

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Leaderboard</h1>
        <Link to="/app" className={styles.backLink}>Back</Link>
      </header>

      <div className={styles.list}>
        {entries.map((entry, idx) => {
          const isCurrent = entry.profile.id === currentUserId;
          const daysLeft = getDaysUntilRace(entry.profile.race_date);

          return (
            <div
              key={entry.profile.id}
              className={`${styles.row} ${isCurrent ? styles.currentRow : ''}`}
            >
              <span className={styles.rank}>#{idx + 1}</span>
              <div
                className={styles.avatar}
                style={{ borderColor: entry.verdict.color }}
              >
                {getInitials(entry.profile.name)}
              </div>
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{entry.profile.name}</span>
                  {daysLeft !== null && (
                    <span className={styles.days}>{daysLeft}d</span>
                  )}
                </div>
                <ReadinessMeter score={entry.scores.total} />
                <span className={styles.verdict} style={{ color: entry.verdict.color }}>
                  {entry.verdict.label}
                </span>
              </div>
            </div>
          );
        })}

        {entries.length === 0 && (
          <p className={styles.empty}>No one has signed up yet. Be the first.</p>
        )}
      </div>

      <nav className={styles.nav}>
        <Link to="/app" className={styles.navLink}>Home</Link>
        <Link to="/leaderboard" className={`${styles.navLink} ${styles.active}`}>Leaderboard</Link>
        <Link to="/profile" className={styles.navLink}>Profile</Link>
      </nav>
    </div>
  );
}
