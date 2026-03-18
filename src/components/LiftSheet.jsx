import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet.jsx';
import {
  LIFTS,
  LIFT_LABELS,
  LIFT_FEEDS,
  LIFT_ICONS,
} from '../lib/constants.js';
import styles from './LiftSheet.module.css';

const LIFT_TRACKING_CACHE_KEY = 'goofhyrox_lift_tracking_cache_v1';

function loadLiftTrackingCache() {
  try {
    const raw = localStorage.getItem(LIFT_TRACKING_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLatestCachedLift(liftId) {
  const entries = loadLiftTrackingCache();
  const filtered = entries
    .filter(e => e?.is_lift === true)
    .filter(e => e?.lift_id === liftId)
    .filter(e => e?.lift_weight_kg !== null && e?.lift_weight_kg !== undefined && e?.lift_weight_kg !== '');

  filtered.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  return filtered[0] || null;
}

export default function LiftSheet({ open, onClose, onLog }) {
  const [step, setStep] = useState(0);
  const [lift, setLift] = useState(null);
  const [heavy, setHeavy] = useState(null);
  const [weightKg, setWeightKg] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');

  function reset() {
    setStep(0);
    setLift(null);
    setHeavy(null);
    setWeightKg('');
    setSets('');
    setReps('');
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!lift) return;
    if (heavy === null) return;

    // Only prefill when the user is still starting from "blank".
    if (weightKg !== '' || sets !== '' || reps !== '') return;

    const latest = getLatestCachedLift(lift.id);
    if (!latest) return;

    if (latest.lift_weight_kg !== null && latest.lift_weight_kg !== undefined) setWeightKg(String(latest.lift_weight_kg));
    if (latest.lift_sets !== null && latest.lift_sets !== undefined) setSets(String(latest.lift_sets));
    if (latest.lift_reps !== null && latest.lift_reps !== undefined) setReps(String(latest.lift_reps));
  }, [open, lift?.id, heavy, weightKg, sets, reps]);

  function handleClose() {
    reset();
    onClose();
  }

  function saveLift() {
    if (!lift || heavy === null) return;

    const parsedWeight = weightKg.trim() === '' ? null : Number(weightKg);
    const parsedSets = sets.trim() === '' ? null : parseInt(sets, 10);
    const parsedReps = reps.trim() === '' ? null : parseInt(reps, 10);

    const tracking = {
      lift_weight_kg: Number.isFinite(parsedWeight) ? parsedWeight : null,
      lift_sets: Number.isFinite(parsedSets) ? parsedSets : null,
      lift_reps: Number.isFinite(parsedReps) ? parsedReps : null,
    };

    onLog({
      is_lift: true,
      lift_id: lift.id,
      heavy,
      is_hyrox: false,
      ...tracking,
      __toast: `${LIFT_ICONS[lift.id] || '🏋️'} ${LIFT_LABELS[lift.id]} logged ✓`,
    });
    handleClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={step === 0 ? 'Pick the lift' : 'Heavy or light?'}
      stepCount={2}
      currentStep={step}
      showBack={step > 0}
      onBack={() => { setStep(0); setLift(null); setHeavy(null); }}
      scrollContent={step === 0}
    >
      {step === 0 && (
        <div className={styles.liftGrid}>
          {LIFTS.map(l => (
            <button
              key={l.id}
              type="button"
              className={styles.liftCard}
              onClick={() => { setLift(l); setStep(1); setHeavy(null); }}
            >
              <span className={styles.liftName}>{LIFT_LABELS[l.id]}</span>
              <span className={styles.liftFeeds}>{LIFT_FEEDS[l.id]}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && lift && (
        <div className={styles.weightStep}>
          <div className={styles.weightRow}>
            <button
              type="button"
              className={`${styles.loadBtn} ${heavy === false ? styles.loadPickedLight : ''}`}
              onClick={() => setHeavy(false)}
            >
              <span className={styles.loadLabel}>Light</span>
              <span className={styles.loadPts}>Working weight</span>
            </button>
            <button
              type="button"
              className={`${styles.loadBtn} ${heavy === true ? styles.loadPickedHeavy : ''}`}
              onClick={() => setHeavy(true)}
            >
              <span className={styles.loadLabel}>Heavy</span>
              <span className={styles.loadPts}>Near max effort</span>
            </button>
          </div>
          {heavy !== null && (
            <div className={styles.previewCard}>
              <p className={styles.previewTitle}>Option</p>
              <p className={styles.previewLine}>
                {heavy === true ? 'Near max effort' : 'Working weight'}
              </p>
              <div className={styles.trackingBlock}>
                <p className={styles.trackingTitle}>Optional Tracking</p>
                <div className={styles.trackingGrid}>
                  <div className={styles.trackingField}>
                    <p className={styles.trackingFieldLabel}>WEIGHT (kg)</p>
                    <input
                      className={styles.trackingInput}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder=""
                    />
                  </div>
                  <div className={styles.trackingField}>
                    <p className={styles.trackingFieldLabel}>SETS</p>
                    <input
                      className={styles.trackingInput}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      value={sets}
                      onChange={(e) => setSets(e.target.value)}
                      placeholder=""
                    />
                  </div>
                  <div className={styles.trackingField}>
                    <p className={styles.trackingFieldLabel}>REPS</p>
                    <input
                      className={styles.trackingInput}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className={styles.saveBtn}
            disabled={heavy === null}
            onClick={saveLift}
          >
            Save workout
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
