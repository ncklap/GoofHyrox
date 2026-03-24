import { useState, useEffect, useRef, useMemo } from 'react';
import BottomSheet from './BottomSheet.jsx';
import {
  ACTIVITY_LABELS,
  ACTIVITY_ICONS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  getActivitiesForCategory,
  formatActivityTargetHint,
  resolveDivisionKeyFromProfile,
  ROW_SKI_TARGETS,
  formatSplitSeconds,
  DEFAULT_DIVISION_KEY,
} from '../lib/constants.js';
import OptionalFields from './OptionalFields.jsx';
import styles from './LogWorkoutSheet.module.css';

function formatDistanceHintMeters(meters, distanceUnit) {
  const n = Number(meters);
  if (!Number.isFinite(n)) return '';
  if (distanceUnit === 'miles') {
    const miles = n / 1609.344;
    const rounded = Math.round(miles * 10) / 10;
    return `${rounded % 1 === 0 ? Math.round(rounded) : rounded}mi`;
  }
  if (n >= 1000) return `${n / 1000}km`;
  return `${n}m`;
}

export default function LogWorkoutSheet({
  open,
  onClose,
  onLog,
  onOpenLift,
  onOpenHyrox,
  distanceUnit = 'km',
  profile = null,
}) {
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activity, setActivity] = useState(null);
  const [value, setValue] = useState('');
  const [ergSplitMin, setErgSplitMin] = useState('');
  const [ergSplitSec, setErgSplitSec] = useState('');
  const [optionalDetails, setOptionalDetails] = useState({});
  const [highlightId, setHighlightId] = useState(null);
  const [feltHard, setFeltHard] = useState(null);
  const inputRef = useRef(null);
  const advanceTimer = useRef(null);

  const activitiesInCategory = selectedCategory ? getActivitiesForCategory(selectedCategory) : [];
  const hasStationStep = activitiesInCategory.length > 1;
  const isErg = activity && (activity.id === 'skierg' || activity.id === 'rowing');

  const divisionKey = useMemo(
    () => resolveDivisionKeyFromProfile(profile),
    [profile]
  );
  const targetSplitSec = ROW_SKI_TARGETS[divisionKey] ?? ROW_SKI_TARGETS[DEFAULT_DIVISION_KEY];

  const ergSplitSeconds = useMemo(() => {
    if (!isErg) return null;
    const mm = parseInt(ergSplitMin, 10);
    const ssRaw = parseInt(ergSplitSec, 10);
    const hasAny = ergSplitMin.trim() !== '' || ergSplitSec.trim() !== '';
    if (!hasAny) return null;
    const m = Number.isFinite(mm) ? mm : 0;
    const s = Number.isFinite(ssRaw) ? Math.min(ssRaw, 59) : 0;
    const total = m * 60 + s;
    return total > 0 ? total : null;
  }, [isErg, ergSplitMin, ergSplitSec]);

  function reset() {
    setStep(0);
    setSelectedCategory(null);
    setActivity(null);
    setValue('');
    setErgSplitMin('');
    setErgSplitSec('');
    setOptionalDetails({});
    setHighlightId(null);
    setFeltHard(null);
  }

  useEffect(() => {
    if (open) reset();
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [open]);

  function handleClose() {
    reset();
    onClose();
  }

  function selectCategory(catId) {
    const activities = getActivitiesForCategory(catId);
    if (activities.length === 1) {
      setSelectedCategory(catId);
      setActivity(activities[0]);
      setStep(2);
      setFeltHard(null);
      setValue('');
      setErgSplitMin('');
      setErgSplitSec('');
    } else {
      setSelectedCategory(catId);
      setActivity(null);
      setStep(1);
      setFeltHard(null);
    }
  }

  function selectActivity(a) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setHighlightId(a.id);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setActivity(a);
      setStep(2);
      setHighlightId(null);
      setFeltHard(null);
      setValue('');
      setErgSplitMin('');
      setErgSplitSec('');
    }, 120);
  }

  useEffect(() => {
    if (open && step === 2 && activity) {
      const t = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open, step, activity]);

  function goBack() {
    if (step === 3) {
      setStep(2);
      setFeltHard(null);
    } else if (step === 2) {
      if (hasStationStep) {
        setStep(1);
        setActivity(null);
        setValue('');
        setErgSplitMin('');
        setErgSplitSec('');
      } else {
        setStep(0);
        setSelectedCategory(null);
        setActivity(null);
        setValue('');
        setErgSplitMin('');
        setErgSplitSec('');
      }
    } else if (step === 1) {
      setStep(0);
      setSelectedCategory(null);
    }
  }

  const numOk = (() => {
    if (isErg) {
      return ergSplitSeconds !== null && ergSplitSeconds > 0;
    }
    const n = parseFloat(value);
    return Number.isFinite(n) && n > 0;
  })();

  async function saveWorkout() {
    if (feltHard === null || !activity) return;
    const mode = optionalDetails.mode || 'distance';
    const mainIsDistance = mode !== 'reps';

    let storedValue;
    let distanceKm = null;
    let distanceM = null;
    let stationReps;

    if (isErg) {
      storedValue = ergSplitSeconds;
      distanceKm = null;
      distanceM = null;
      stationReps = optionalDetails.stationReps ?? null;
    } else {
      const n = parseFloat(value);
      storedValue = activity.id === 'run'
        ? n * 1000
        : parseInt(value, 10);
      distanceKm = activity.id === 'run' && mainIsDistance && Number.isFinite(n) ? n : null;
      distanceM = activity.id !== 'run' && mainIsDistance && Number.isFinite(n) ? n : null;
      stationReps = mode === 'reps' && Number.isFinite(n)
        ? parseInt(value, 10)
        : (optionalDetails.stationReps ?? null);
    }

    const res = await onLog({
      activity_id: activity.id,
      value: storedValue,
      distance_km: distanceKm,
      distance_m: distanceM,
      duration_seconds: optionalDetails.durationSeconds ?? null,
      pace_per_unit: optionalDetails.pacePerUnit ?? null,
      station_weight_lbs: optionalDetails.stationWeightLbs ?? null,
      station_weight_kg: optionalDetails.stationWeightKg ?? null,
      station_reps: stationReps,
      hard: feltHard,
      is_lift: false,
      is_hyrox: false,
      __toast: `${ACTIVITY_ICONS[activity.id]} ${ACTIVITY_LABELS[activity.id]} logged ✓`,
    });
    if (res?.error) return;
    handleClose();
  }

  const valueStepTitle = !activity
    ? 'Log'
    : activity.unit === 'reps'
      ? 'How many reps?'
      : activity.id === 'run'
        ? 'How far?'
        : isErg
          ? '500m split'
          : 'How far?';

  const stepTitles = [
    'What did you do?',
    'Which station?',
    valueStepTitle,
    'How did it feel?',
  ];
  const title = stepTitles[step];

  const stepCount = hasStationStep ? 4 : 3;
  const currentStep = step === 0 ? 1 : step === 1 ? 2 : step === 2 ? (hasStationStep ? 3 : 2) : (hasStationStep ? 4 : 3);

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={title}
      stepCount={stepCount}
      currentStep={currentStep}
      showBack={step > 0}
      onBack={goBack}
      scrollContent={step === 0 || step === 1}
    >
      {step === 0 && (
        <>
          <div className={styles.stationList}>
            {CATEGORY_ORDER.map((catId) => (
              <button
                key={catId}
                type="button"
                className={`${styles.stationRow} ${highlightId === catId ? styles.stationSelected : ''}`}
                onClick={() => selectCategory(catId)}
              >
                <span className={styles.stationEmoji} aria-hidden>{CATEGORY_ICONS[catId]}</span>
                <span className={styles.stationName}>{CATEGORY_LABELS[catId]}</span>
              </button>
            ))}
          </div>
          <div className={styles.sheetDivider} />
          <div className={styles.specialRow}>
            <button
              type="button"
              className={styles.specialBtn}
              onClick={() => {
                handleClose();
                onOpenLift?.();
              }}
            >
              <span className={styles.stationEmoji} aria-hidden>🔥</span>
              <span className={styles.stationName}>Lift</span>
            </button>
            <button
              type="button"
              className={styles.specialBtn}
              onClick={() => {
                handleClose();
                onOpenHyrox?.();
              }}
            >
              <span className={styles.stationEmoji} aria-hidden>🏁</span>
              <span className={styles.stationName}>Hyrox Workout</span>
            </button>
          </div>
          <div className={styles.sheetSpacer} />
        </>
      )}

      {step === 1 && selectedCategory && (
        <div className={styles.stationList}>
          {activitiesInCategory.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`${styles.stationRow} ${highlightId === a.id ? styles.stationSelected : ''}`}
              onClick={() => selectActivity(a)}
            >
              <span className={styles.stationEmoji} aria-hidden>{ACTIVITY_ICONS[a.id]}</span>
              <span className={styles.stationName}>{ACTIVITY_LABELS[a.id]}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && activity && (
        <div className={styles.valueStep}>
          {isErg ? (
            <>
              <p className={styles.unitLabel}>500M PACE (MM:SS)</p>
              <div className={styles.inputRow}>
                <input
                  ref={inputRef}
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={ergSplitMin}
                  onChange={(e) => setErgSplitMin(e.target.value)}
                  placeholder="mm"
                />
                <span className={styles.unitLabel} style={{ margin: '0 4px' }}>:</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  step="1"
                  value={ergSplitSec}
                  onChange={(e) => setErgSplitSec(e.target.value)}
                  placeholder="ss"
                />
              </div>
              <OptionalFields
                activityId={activity.id}
                distancePreference={distanceUnit}
                primaryValue=""
                suppressTimePace
                onChange={setOptionalDetails}
              />
              <p className={styles.targetHint}>
                Target pace for your division ≈ {formatSplitSeconds(targetSplitSec)} /500m
              </p>
            </>
          ) : (
            <>
              <p className={styles.unitLabel}>
                {activity.unit === 'reps'
                  ? 'REPS'
                  : activity.id === 'run'
                    ? 'KM'
                    : 'METERS'}
              </p>
              <div className={styles.inputRow}>
                <input
                  ref={inputRef}
                  className={styles.input}
                  type="number"
                  inputMode={activity.id === 'run' ? 'decimal' : 'numeric'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  step={activity.id === 'run' ? '0.1' : '1'}
                />
              </div>
              <OptionalFields
                activityId={activity.id}
                distancePreference={distanceUnit}
                primaryValue={value}
                onChange={setOptionalDetails}
              />
              <p className={styles.targetHint}>
                {activity.id === 'run'
                  ? `Race = ${formatDistanceHintMeters(activity.raceTarget, distanceUnit)} · Target = ${formatDistanceHintMeters(activity.target, distanceUnit)}`
                  : formatActivityTargetHint(activity)}
              </p>
            </>
          )}
          <button
            type="button"
            className={styles.nextBtn}
            disabled={!numOk}
            onClick={() => setStep(3)}
          >
            Next →
          </button>
        </div>
      )}

      {step === 3 && activity && (
        <div className={styles.hardStep}>
          <div className={styles.hardRow}>
            <button
              type="button"
              className={`${styles.hardBtn} ${styles.hardYes} ${feltHard === true ? styles.hardPicked : ''}`}
              onClick={() => setFeltHard(true)}
            >
              <span className={styles.hardEmoji} aria-hidden>😤</span>
              <span className={styles.hardMain}>YES</span>
              <span className={styles.hardSub}>Challenging / at my limit</span>
            </button>
            <button
              type="button"
              className={`${styles.hardBtn} ${styles.hardNo} ${feltHard === false ? styles.hardPickedNo : ''}`}
              onClick={() => setFeltHard(false)}
            >
              <span className={styles.hardEmoji} aria-hidden>😎</span>
              <span className={styles.hardMain}>NO</span>
              <span className={styles.hardSub}>Comfortable / in control</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.saveWorkoutBtn}
            disabled={feltHard === null}
            onClick={saveWorkout}
          >
            Save workout
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
