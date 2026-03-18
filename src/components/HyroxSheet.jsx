import { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import styles from './HyroxSheet.module.css';

const LENGTHS = [
  { id: 'quarter', label: 'Quarter', desc: '25% of each station' },
  { id: 'half', label: 'Half', desc: '50% of each station' },
  { id: 'full', label: 'Full', desc: '100% of each station' },
];

export default function HyroxSheet({ open, onClose, onLog }) {
  const [step, setStep] = useState(0);
  const [length, setLength] = useState(null);

  function reset() {
    setStep(0);
    setLength(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectLength(l) {
    setLength(l);
    setStep(1);
  }

  function submitIntensity(intensity) {
    onLog({
      is_hyrox: true,
      hyrox_length: length.id,
      hyrox_intensity: intensity,
      is_lift: false,
    });
    handleClose();
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Log HYROX Workout">
      {step === 0 && (
        <div className={styles.options}>
          {LENGTHS.map(l => (
            <button
              key={l.id}
              className={styles.optionBtn}
              onClick={() => selectLength(l)}
            >
              <span className={styles.optionLabel}>{l.label}</span>
              <span className={styles.optionDesc}>{l.desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className={styles.intensityStep}>
          <p className={styles.stepLabel}>How was the intensity?</p>
          <div className={styles.intensityRow}>
            <button
              className={`${styles.intensityBtn} ${styles.easy}`}
              onClick={() => submitIntensity('easy')}
            >
              Easy
            </button>
            <button
              className={`${styles.intensityBtn} ${styles.hard}`}
              onClick={() => submitIntensity('hard')}
            >
              Hard
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
