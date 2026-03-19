import styles from './ReadinessMeter.module.css';

function levelFromScore(score, hasWorkouts) {
  if (!hasWorkouts && score === 0) return 0;
  if (score <= 0) return 1;
  return Math.min(10, Math.max(1, Math.ceil(score / 40)));
}

function fillClassAndStyle(level) {
  if (level === 0) return { className: styles.fillMuted, style: {} };
  if (level <= 4) return { className: styles.fillRed, style: {} };
  if (level <= 6) return { className: styles.fillOrange, style: {} };
  if (level === 7) return { className: styles.fillYellow, style: {} };
  if (level <= 9) return { className: styles.fillGreen, style: {} };
  return {
    className: styles.fillElite,
    style: { boxShadow: '0 0 12px rgba(232, 255, 90, 0.5)' },
  };
}

export default function ReadinessMeter({
  score,
  max = 400,
  compact = false,
  hasWorkouts = true,
  statusText,
  statusTone,
}) {
  const pct = Math.min((score / max) * 100, 100);
  const level = levelFromScore(score, hasWorkouts);
  const { className, style } = fillClassAndStyle(level);

  if (compact) {
    return (
      <div className={styles.compactTrack}>
        <div
          className={`${styles.compactFill} ${className}`}
          style={{ width: `${pct}%`, ...style }}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.labelRow}>
        <span className={styles.meterLabel}>Readiness Meter</span>
        <span className={styles.pct}>{Math.round(pct)}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${className}`}
          style={{ width: `${pct}%`, ...style }}
        />
      </div>
      {statusText ? (
        <p
          className={[
            styles.statusLine,
            statusTone === 'notReady' || statusTone === 'onboarding'
              ? styles.statusRed
              : (statusTone === 'orange' || statusTone === 'yellow')
                ? styles.statusBlue
                : styles.statusGreen,
          ].join(' ')}
        >
          {statusText}
        </p>
      ) : null}
    </div>
  );
}
