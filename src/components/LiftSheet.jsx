import { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import { LIFTS, LIFT_LABELS } from '../lib/constants.js';
import styles from './LiftSheet.module.css';

export default function LiftSheet({ open, onClose, onLog }) {
  const [step, setStep] = useState(0);
  const [lift, setLift] = useState(null);

  function reset() {
    setStep(0);
    setLift(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectLift(l) {
    setLift(l);
    setStep(1);
  }

  function submitWeight(heavy) {
    onLog({
      is_lift: true,
      lift_id: lift.id,
      heavy,
      is_hyrox: false,
    });
    handleClose();
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Log Lift">
      {step === 0 && (
        <div className={styles.grid}>
          {LIFTS.map(l => (
            <button
              key={l.id}
              className={styles.liftBtn}
              onClick={() => selectLift(l)}
            >
              {LIFT_LABELS[l.id]}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className={styles.weightStep}>
          <p className={styles.stepLabel}>{LIFT_LABELS[lift.id]} — How heavy?</p>
          <div className={styles.weightRow}>
            <button
              className={`${styles.weightBtn} ${styles.light}`}
              onClick={() => submitWeight(false)}
            >
              Light
              <span className={styles.pts}>15 pts</span>
            </button>
            <button
              className={`${styles.weightBtn} ${styles.heavy}`}
              onClick={() => submitWeight(true)}
            >
              Heavy
              <span className={styles.pts}>30 pts</span>
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
