import styles from './VerdictDisplay.module.css';

export default function VerdictDisplay({ verdict, score }) {
  return (
    <div className={styles.container}>
      <p className={styles.label}>HYROX READY?</p>
      <h1 className={styles.verdict} style={{ color: verdict.color }}>
        {verdict.label}
      </h1>
      <p className={styles.score}>
        <span className={styles.scoreValue}>{score}</span>
        <span className={styles.scoreMax}> / 400</span>
      </p>
    </div>
  );
}
