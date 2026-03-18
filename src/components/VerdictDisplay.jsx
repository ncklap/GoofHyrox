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
      <p className={styles.label}>HYROX READY?</p>
      <h1 className={`${styles.verdict} ${toneClass}`}>{verdict.label}</h1>
      <p className={styles.savage}>The meter doesn&apos;t lie. Train harder.</p>
    </div>
  );
}
