import styles from './VerdictDisplay.module.css';

const TONE_CLASS = {
  onboarding: styles.onboarding,
  notReady: styles.notReady,
  orange: styles.orange,
  yellow: styles.yellow,
  ready: styles.ready,
  crush: styles.crush,
  elite: styles.elite,
};

export default function VerdictDisplay({ verdict }) {
  const toneClass = TONE_CLASS[verdict.tone] || styles.notReady;

  return (
    <div className={styles.container}>
      <p className={styles.label}>RACE COUNTDOWN</p>
      <h1 className={`${styles.verdict} ${toneClass}`}>{verdict.label}</h1>
    </div>
  );
}
