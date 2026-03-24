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
const BAR_WEIGHT_LBS = 45;
const LBS_PER_KG = 2.205;
const BAR_WEIGHT_KG = BAR_WEIGHT_LBS / LBS_PER_KG;
let nextSetRowId = 1;

function makeSetRow(seed = {}) {
  return {
    id: nextSetRowId++,
    perSideLbs: seed.perSideLbs ?? '',
    reps: seed.reps ?? '',
  };
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculateTotalLbs(perSideLbs) {
  const perSide = toNum(perSideLbs);
  if (perSide === null || perSide < 0) return null;
  return (perSide * 2) + BAR_WEIGHT_LBS;
}

function calculateTotalWeight(perSideValue, weightUnit) {
  if (weightUnit === 'lbs') {
    const totalLbs = calculateTotalLbs(perSideValue);
    if (totalLbs === null) return null;
    return { total: totalLbs, unit: 'lbs', totalKg: totalLbs / LBS_PER_KG };
  }
  const perSide = toNum(perSideValue);
  if (perSide === null || perSide < 0) return null;
  const totalKg = (perSide * 2) + BAR_WEIGHT_KG;
  return { total: totalKg, unit: 'kg', totalKg };
}

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

export default function LiftSheet({ open, onClose, onLog, weightUnit = 'kg' }) {
  const [step, setStep] = useState(0);
  const [lift, setLift] = useState(null);
  const [heavy, setHeavy] = useState(null);
  const [setRows, setSetRows] = useState(() => [makeSetRow()]);
  const [formError, setFormError] = useState('');

  function reset() {
    setStep(0);
    setLift(null);
    setHeavy(null);
    setSetRows([makeSetRow()]);
    setFormError('');
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!lift) return;
    if (heavy === null) return;

    // Only prefill when the user is still starting from "blank".
    const first = setRows[0];
    if (!first || first.perSideLbs !== '' || first.reps !== '' || setRows.length > 1) return;

    const latest = getLatestCachedLift(lift.id);
    if (!latest) return;

    let nextPerSide = '';
    if (latest.lift_weight_kg !== null && latest.lift_weight_kg !== undefined && latest.lift_weight_kg !== '') {
      const totalWeight = weightUnit === 'lbs'
        ? Number(latest.lift_weight_kg) * LBS_PER_KG
        : Number(latest.lift_weight_kg);
      const barWeight = weightUnit === 'lbs' ? BAR_WEIGHT_LBS : BAR_WEIGHT_KG;
      const inferredPerSide = (totalWeight - barWeight) / 2;
      if (Number.isFinite(inferredPerSide) && inferredPerSide >= 0) {
        nextPerSide = String(Math.round(inferredPerSide * 2) / 2);
      }
    }

    let nextReps = '';
    const latestSets = Number(latest.lift_sets);
    const latestReps = Number(latest.lift_reps);
    if (Number.isFinite(latestSets) && latestSets > 0 && Number.isFinite(latestReps) && latestReps > 0) {
      nextReps = String(Math.max(1, Math.round(latestReps / latestSets)));
    }

    if (nextPerSide || nextReps) {
      setSetRows([makeSetRow({ perSideLbs: nextPerSide, reps: nextReps })]);
    }
  }, [open, lift?.id, heavy, setRows, weightUnit]);

  function handleClose() {
    reset();
    onClose();
  }

  function updateSetRow(rowId, key, value) {
    setSetRows(prev => prev.map(row => (row.id === rowId ? { ...row, [key]: value } : row)));
  }

  function addSetRow() {
    setSetRows(prev => {
      const last = prev[prev.length - 1];
      return [...prev, makeSetRow({ perSideLbs: last?.perSideLbs ?? '', reps: last?.reps ?? '' })];
    });
  }

  function removeSetRow(rowId) {
    setSetRows(prev => (prev.length <= 1 ? prev : prev.filter(row => row.id !== rowId)));
  }

  async function saveLift() {
    if (!lift || heavy === null) return;
    setFormError('');

    const rowStates = setRows.map((row) => {
      const perSide = toNum(row.perSideLbs);
      const repsNum = parseInt(row.reps, 10);
      const hasPerSideInput = row.perSideLbs.trim() !== '';
      const hasRepsInput = row.reps.trim() !== '';
      const hasAnyInput = hasPerSideInput || hasRepsInput;
      const isValidComplete =
        hasAnyInput &&
        perSide !== null &&
        perSide >= 0 &&
        Number.isFinite(repsNum) &&
        repsNum > 0;
      return {
        row,
        hasAnyInput,
        isValidComplete,
        perSide,
        repsNum: Number.isFinite(repsNum) ? repsNum : null,
      };
    });

    const hasPartialRow = rowStates.some(x => x.hasAnyInput && !x.isValidComplete);
    if (hasPartialRow) {
      setFormError('Complete or clear any partially filled set row.');
      return;
    }

    const completedRows = rowStates.filter(x => x.isValidComplete);
    const liftSetRows = completedRows.map((x, idx) => {
      const total = calculateTotalWeight(x.row.perSideLbs, weightUnit);
      const weightKg = total ? total.totalKg : null;
      return {
        set_number: idx + 1,
        weight_kg: weightKg,
        reps: x.repsNum,
      };
    });

    const heaviestWeightKg = liftSetRows.length
      ? Math.max(...liftSetRows.map(s => Number(s.weight_kg || 0)))
      : null;
    const totalReps = liftSetRows.length
      ? liftSetRows.reduce((sum, s) => sum + Number(s.reps || 0), 0)
      : null;

    const tracking = {
      lift_weight_kg: Number.isFinite(heaviestWeightKg) ? heaviestWeightKg : null,
      lift_sets: liftSetRows.length > 0 ? liftSetRows.length : null,
      lift_reps: Number.isFinite(totalReps) ? totalReps : null,
    };

    const { error } = await onLog({
      is_lift: true,
      lift_id: lift.id,
      heavy,
      is_hyrox: false,
      lift_set_rows: liftSetRows,
      ...tracking,
      __toast: `${LIFT_ICONS[lift.id] || '🏋️'} ${LIFT_LABELS[lift.id]} logged ✓`,
    });
    if (error) {
      setFormError(error.message || 'Could not save lift workout.');
      return;
    }
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
      scrollContent
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
                <p className={styles.trackingTitle}>Set Builder (optional)</p>
                <div className={styles.setHeaderRow}>
                  <span className={styles.setHeaderCol}>Set #</span>
                  <span className={styles.setHeaderCol}>{weightUnit} per side</span>
                  <span className={styles.setHeaderCol}>Reps</span>
                  <span className={styles.setHeaderCol} aria-hidden />
                </div>
                <div className={styles.setRowsWrap}>
                  {setRows.map((row, idx) => {
                    const total = calculateTotalWeight(row.perSideLbs, weightUnit);
                    return (
                      <div key={row.id} className={styles.setRow}>
                        <div className={styles.setNum} aria-label={`Set ${idx + 1}`}>
                          {idx + 1}
                        </div>
                        <div className={styles.weightField}>
                          <input
                            className={styles.trackingInput}
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            value={row.perSideLbs}
                            onChange={(e) => updateSetRow(row.id, 'perSideLbs', e.target.value)}
                            placeholder="0"
                          />
                          <p className={styles.totalHint}>
                            {total
                              ? `= ${Math.round(total.total * 10) / 10} ${total.unit} total`
                              : '\u00A0'}
                          </p>
                        </div>
                        <div className={styles.repsField}>
                          <input
                            className={styles.trackingInput}
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="1"
                            value={row.reps}
                            onChange={(e) => updateSetRow(row.id, 'reps', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        {setRows.length > 1 ? (
                          <button
                            type="button"
                            className={styles.deleteSetBtn}
                            onClick={() => removeSetRow(row.id)}
                            aria-label={`Delete set ${idx + 1}`}
                          >
                            ×
                          </button>
                        ) : (
                          <span className={styles.deleteSetSpacer} aria-hidden />
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" className={styles.addSetBtn} onClick={addSetRow}>
                  + Add Set
                </button>
                {formError ? (
                  <p className={styles.formError} role="alert">
                    {formError}
                  </p>
                ) : null}
                <p className={styles.optionalHint}>
                  Skip set details if you want a faster log.
                </p>
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
