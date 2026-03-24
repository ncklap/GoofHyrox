import { useEffect, useMemo, useState } from 'react';
import { EXERCISE_CONFIG } from '../config/exerciseConfig.js';
import styles from './OptionalFields.module.css';

const LBS_PER_KG = 2.205;

function parsePositiveNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeInt(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function roundTo(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function getDistanceInputUnit(config, distancePreference) {
  if (!config?.distanceUnit) return null;
  if (config.distanceUnit === 'km' && distancePreference === 'miles') return 'mile';
  return config.distanceUnit;
}

function getPaceLabel(config, distancePreference) {
  if (!config?.autoPace) return '';
  if (config.distanceUnit === 'km' && distancePreference === 'miles') return 'min/mile';
  return config.paceLabel || '';
}

function getWeightLabel(formula) {
  if (formula === 'barbell') return 'lbs per side';
  if (formula === 'perHand') return 'lbs per hand';
  return 'lbs';
}

function computeWeightPreview(weightLbs, formula) {
  const w = parsePositiveNumber(weightLbs);
  if (w === null) return null;
  if (formula === 'barbell') return { totalLbs: (w * 2) + 45, suffix: 'lbs total' };
  if (formula === 'perHand') return { totalLbs: w * 2, suffix: 'lbs total' };
  return { totalLbs: w, suffix: 'lbs' };
}

export default function OptionalFields({
  activityId,
  onChange,
  distancePreference = 'km',
  primaryValue = '',
  /** When true, hide time inputs and auto-pace (e.g. SkiErg/Row use 500m split in parent) */
  suppressTimePace = false,
}) {
  const config = EXERCISE_CONFIG[activityId];
  const [mode, setMode] = useState('distance');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [reps, setReps] = useState('');

  useEffect(() => {
    if (!config) return;
    if (config.repDistanceToggle) {
      const defaultMode = config.reps ? 'reps' : 'distance';
      setMode(defaultMode);
    } else if (config.reps) {
      setMode('reps');
    } else {
      setMode('distance');
    }
    setTimeMin('');
    setTimeSec('');
    setWeightLbs('');
    setReps('');
  }, [activityId, config]);

  const distanceUnit = getDistanceInputUnit(config, distancePreference);
  const paceLabel = getPaceLabel(config, distancePreference);
  const weightPreview = useMemo(
    () => computeWeightPreview(weightLbs, config?.weightFormula),
    [weightLbs, config?.weightFormula]
  );

  const payload = useMemo(() => {
    if (!config) return {};

    const distanceValue = parsePositiveNumber(primaryValue);
    let distanceKm = null;
    let distanceM = null;
    if (distanceValue !== null) {
      if (config.distanceUnit === 'km') {
        if (distancePreference === 'miles') {
          distanceKm = distanceValue * 1.609344;
        } else {
          distanceKm = distanceValue;
        }
      } else if (config.distanceUnit === 'm') {
        distanceM = distanceValue;
      }
    }

    const mm = parseNonNegativeInt(timeMin) ?? 0;
    const ssRaw = parseNonNegativeInt(timeSec) ?? 0;
    const ss = Math.min(ssRaw, 59);
    const hasTimeInput = (timeMin.trim() !== '' || timeSec.trim() !== '');
    const durationSeconds = hasTimeInput ? (mm * 60) + ss : null;

    let pacePerUnit = null;
    if (config.autoPace && durationSeconds && durationSeconds > 0) {
      const paceDistance = config.distanceUnit === 'km' ? distanceKm : config.distanceUnit === 'm' ? distanceM : null;
      if (paceDistance && paceDistance > 0) {
        pacePerUnit = durationSeconds / 60 / paceDistance;
      }
    }

    const stationWeightLbs = parsePositiveNumber(weightLbs);
    const stationWeightKg = stationWeightLbs !== null ? roundTo(stationWeightLbs / LBS_PER_KG, 2) : null;
    const stationReps = parsePositiveNumber(reps) !== null ? parseInt(reps, 10) : null;

    // Mode gates the dual entry pattern (distance/reps) exercises.
    return {
      mode,
      timeMin: hasTimeInput ? mm : null,
      timeSec: hasTimeInput ? ss : null,
      durationSeconds,
      pacePerUnit,
      stationWeightLbs,
      stationWeightKg,
      stationReps: mode === 'reps' ? stationReps : config.reps ? stationReps : null,
    };
  }, [config, distancePreference, mode, primaryValue, reps, timeMin, timeSec, weightLbs]);

  useEffect(() => {
    if (!onChange) return;
    onChange(payload);
  }, [payload, onChange]);

  if (!config) return null;

  const showReps = Boolean(config.reps) || (config.repDistanceToggle && mode === 'reps');
  const showTime = Boolean(config.time) && !suppressTimePace;
  const showWeight = Boolean(config.weight);

  const paceText = (() => {
    if (suppressTimePace || !config.autoPace || !payload.pacePerUnit) return '';
    const totalSec = Math.round(payload.pacePerUnit * 60);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${mm}:${String(ss).padStart(2, '0')} ${paceLabel}`;
  })();

  return (
    <div className={styles.wrap}>
      <p className={styles.heading}>Optional details</p>

      {config.repDistanceToggle && (
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === 'distance' ? styles.toggleBtnActive : ''}`}
            onClick={() => setMode('distance')}
          >
            Distance
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === 'reps' ? styles.toggleBtnActive : ''}`}
            onClick={() => setMode('reps')}
          >
            Reps
          </button>
        </div>
      )}

      {showTime && (
        <div className={styles.field}>
          <p className={styles.label}>Time</p>
          <div className={styles.timeRow}>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={timeMin}
              onChange={(e) => setTimeMin(e.target.value)}
              placeholder="mm"
            />
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              step="1"
              value={timeSec}
              onChange={(e) => setTimeSec(e.target.value)}
              placeholder="ss"
            />
          </div>
        </div>
      )}

      {config.autoPace && !suppressTimePace && (
        <p className={styles.hint}>
          {paceText || '\u00A0'}
        </p>
      )}

      {showWeight && (
        <div className={styles.field}>
          <p className={styles.label}>{getWeightLabel(config.weightFormula)}</p>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)}
            placeholder="0"
          />
          <p className={styles.hint}>
            {weightPreview ? `= ${roundTo(weightPreview.totalLbs, 1)} ${weightPreview.suffix}` : '\u00A0'}
          </p>
        </div>
      )}

      {showReps && (
        <div className={styles.field}>
          <p className={styles.label}>Reps</p>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="0"
          />
        </div>
      )}
    </div>
  );
}
