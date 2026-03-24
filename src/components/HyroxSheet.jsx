import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet.jsx';
import { CATEGORIES, CATEGORY_ORDER, CATEGORY_PREVIEW, CATEGORY_SUM_MAX } from '../lib/constants.js';
import { getHyroxSessionPoints } from '../lib/scoring.js';
import styles from './HyroxSheet.module.css';

const LENGTHS = [
  { id: 'quarter', label: 'Quarter', pct: 0.25, toast: 'Quarter' },
  { id: 'half', label: 'Half', pct: 0.5, toast: 'Half' },
  { id: 'full', label: 'Full', pct: 1, toast: 'Full' },
];

function hyroxPreviewLine(length, intensity) {
  if (!length || !intensity) return '';
  const sessionPts = getHyroxSessionPoints({
    hyrox_length: length.id,
    hyrox_intensity: intensity,
  });
  const parts = CATEGORY_ORDER.map((cat) => {
    const pts = Math.round(sessionPts * (CATEGORIES[cat].max / CATEGORY_SUM_MAX));
    const { icon, label } = CATEGORY_PREVIEW[cat];
    return `${icon} ${label} +${pts}`;
  });
  return parts.join(' · ');
}

export default function HyroxSheet({ open, onClose, onLog }) {
  const [step, setStep] = useState(0);
  const [length, setLength] = useState(null);
  const [intensity, setIntensity] = useState(null);

  function reset() {
    setStep(0);
    setLength(null);
    setIntensity(null);
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  function handleClose() {
    reset();
    onClose();
  }

  function saveHyrox() {
    if (!length || !intensity) return;
    onLog({
      is_hyrox: true,
      hyrox_length: length.id,
      hyrox_intensity: intensity,
      is_lift: false,
      __toast: `🏁 Hyrox ${length.toast} logged ✓`,
    });
    handleClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={step === 0 ? 'Hyrox workout' : 'How did it feel?'}
      stepCount={2}
      currentStep={step}
      showBack={step > 0}
      onBack={() => { setStep(0); setLength(null); setIntensity(null); }}
      scrollContent={step === 0}
    >
      {step === 0 && (
        <div className={styles.lengthGrid}>
          {LENGTHS.map(l => (
            <button
              key={l.id}
              type="button"
              className={styles.lengthBtn}
              onClick={() => { setLength(l); setStep(1); setIntensity(null); }}
            >
              <span className={styles.lengthName}>{l.label}</span>
              <span className={styles.lengthDesc}>
                {l.id === 'quarter' && '25% each station'}
                {l.id === 'half' && '50% each station'}
                {l.id === 'full' && '100% each station'}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && length && (
        <div className={styles.intensityStep}>
          <div className={styles.intRow}>
            <button
              type="button"
              className={`${styles.intBtn} ${intensity === 'easy' ? styles.intPickedEasy : ''}`}
              onClick={() => setIntensity('easy')}
            >
              <span className={styles.intEmoji} aria-hidden>😎</span>
              <span className={styles.intLabel}>Comfortable / in control</span>
              <span className={styles.intSub}>Felt solid</span>
            </button>
            <button
              type="button"
              className={`${styles.intBtn} ${intensity === 'hard' ? styles.intPickedHard : ''}`}
              onClick={() => setIntensity('hard')}
            >
              <span className={styles.intEmoji} aria-hidden>😤</span>
              <span className={styles.intLabel}>Challenging / at my limit</span>
              <span className={styles.intSub}>It was rough</span>
            </button>
          </div>
          {intensity && (
            <div className={styles.previewCard}>
              <p className={styles.previewTitle}>Points this session</p>
              <p className={styles.previewLine}>{hyroxPreviewLine(length, intensity)}</p>
            </div>
          )}
          <button
            type="button"
            className={styles.saveBtn}
            disabled={!intensity}
            onClick={saveHyrox}
          >
            Save workout
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
