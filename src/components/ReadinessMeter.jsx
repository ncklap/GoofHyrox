import styles from './ReadinessMeter.module.css';

export default function ReadinessMeter({ score, max = 400 }) {
  const pct = Math.min((score / max) * 100, 100);

  let barColor = 'var(--accent-red)';
  if (score >= 330) barColor = 'var(--accent-green)';
  else if (score >= 280) barColor = 'var(--accent-yellow)';
  else if (score >= 180) barColor = 'var(--accent-orange)';

  return (
    <div className={styles.container}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className={styles.pct}>{Math.round(pct)}%</span>
    </div>
  );
}
