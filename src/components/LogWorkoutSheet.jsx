import { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import { ACTIVITIES, ACTIVITY_LABELS } from '../lib/constants.js';
import styles from './LogWorkoutSheet.module.css';

export default function LogWorkoutSheet({ open, onClose, onLog }) {
  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState(null);
  const [value, setValue] = useState('');

  function reset() {
    setStep(0);
    setActivity(null);
    setValue('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectActivity(a) {
    setActivity(a);
    setStep(1);
  }

  function submitValue() {
    const num = parseInt(value, 10);
    if (!num || num <= 0) return;
    setStep(2);
  }

  function submitIntensity(hard) {
    const num = parseInt(value, 10);
    onLog({
      activity_id: activity.id,
      value: num,
      hard,
      is_lift: false,
      is_hyrox: false,
    });
    handleClose();
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Log Workout">
      {step === 0 && (
        <div className={styles.grid}>
          {ACTIVITIES.map(a => (
            <button
              key={a.id}
              className={styles.activityBtn}
              onClick={() => selectActivity(a)}
            >
              {ACTIVITY_LABELS[a.id]}
            </button>
          ))}
        </div>
      )}

      {step === 1 && activity && (
        <div className={styles.valueStep}>
          <p className={styles.stepLabel}>
            {ACTIVITY_LABELS[activity.id]} — How much?
          </p>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Target: ${activity.target}${activity.unit}`}
              autoFocus
            />
            <span className={styles.unit}>{activity.unit}</span>
          </div>
          <button className={styles.nextBtn} onClick={submitValue}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className={styles.intensityStep}>
          <p className={styles.stepLabel}>How did it feel?</p>
          <div className={styles.intensityRow}>
            <button
              className={`${styles.intensityBtn} ${styles.easy}`}
              onClick={() => submitIntensity(false)}
            >
              Easy / Normal
            </button>
            <button
              className={`${styles.intensityBtn} ${styles.hard}`}
              onClick={() => submitIntensity(true)}
            >
              Hard / Struggled
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
