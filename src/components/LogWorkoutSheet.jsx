import { useState, useEffect, useRef } from 'react';
import BottomSheet from './BottomSheet.jsx';
import {
  ACTIVITY_LABELS,
  ACTIVITY_ICONS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  getActivitiesForCategory,
  formatActivityTargetHint,
} from '../lib/constants.js';
import styles from './LogWorkoutSheet.module.css';

export default function LogWorkoutSheet({ open, onClose, onLog, onOpenLift, onOpenHyrox }) {
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activity, setActivity] = useState(null);
  const [value, setValue] = useState('');
  const [highlightId, setHighlightId] = useState(null);
  const [feltHard, setFeltHard] = useState(null);
  const inputRef = useRef(null);
  const advanceTimer = useRef(null);

  const activitiesInCategory = selectedCategory ? getActivitiesForCategory(selectedCategory) : [];
  const hasStationStep = activitiesInCategory.length > 1;

  function reset() {
    setStep(0);
    setSelectedCategory(null);
    setActivity(null);
    setValue('');
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
      } else {
        setStep(0);
        setSelectedCategory(null);
        setActivity(null);
        setValue('');
      }
    } else if (step === 1) {
      setStep(0);
      setSelectedCategory(null);
    }
  }

  const numOk = (() => {
    const n = parseFloat(value);
    return Number.isFinite(n) && n > 0;
  })();

  async function saveWorkout() {
    if (feltHard === null || !activity) return;
    const n = parseFloat(value);
    // Run is stored/scored in meters, but user enters kilometers.
    const storedValue = activity.id === 'run' ? n * 1000 : parseInt(value, 10);
    const res = await onLog({
      activity_id: activity.id,
      value: storedValue,
      hard: feltHard,
      is_lift: false,
      is_hyrox: false,
      __toast: `${ACTIVITY_ICONS[activity.id]} ${ACTIVITY_LABELS[activity.id]} logged ✓`,
    });
    if (res?.error) return;
    handleClose();
  }

  const stepTitles = [
    'What did you do?',
    'Which station?',
    activity?.unit === 'reps' ? 'How many reps?' : 'How far?',
    'Did it feel hard?',
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
          <p className={styles.unitLabel}>
            {activity.unit === 'reps' ? 'REPS' : activity.id === 'run' ? 'KM' : 'METERS'}
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
          <p className={styles.targetHint}>{formatActivityTargetHint(activity)}</p>
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
              <span className={styles.hardSub}>It was rough</span>
            </button>
            <button
              type="button"
              className={`${styles.hardBtn} ${styles.hardNo} ${feltHard === false ? styles.hardPickedNo : ''}`}
              onClick={() => setFeltHard(false)}
            >
              <span className={styles.hardEmoji} aria-hidden>😎</span>
              <span className={styles.hardMain}>NO</span>
              <span className={styles.hardSub}>Felt solid</span>
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
