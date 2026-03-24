import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import BottomSheet from './BottomSheet.jsx';
import { EXERCISE_CONFIG } from '../config/exerciseConfig.js';
import {
  formatDate,
  formatDuration,
  workoutIcon,
  workoutTitle,
} from '../lib/workoutFormatters.js';
import {
  computeLiftSessionVolume,
  getHistoricalMaxWeights,
  getPRStatus,
  getPreviousWorkout,
} from '../lib/workoutComparison.js';
import {
  LEGACY_ERG_METERS_THRESHOLD,
  LABEL_INTENSITY_CHALLENGING,
  LABEL_INTENSITY_COMFORTABLE,
} from '../lib/constants.js';
import { getWorkoutSessionPoints } from '../lib/scoring.js';
import { supabase } from '../lib/supabase.js';
import styles from './WorkoutDetailSheet.module.css';

function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getLiftMaxLbs(workout, sets) {
  if (sets?.length) {
    return Math.max(
      ...sets.map((s) => Number(s.weight_kg || 0) * 2.205),
      0
    );
  }
  return Number(workout?.lift_weight_kg || 0) * 2.205;
}

function getDurationFromWorkout(workout) {
  return Number.isFinite(Number(workout?.duration_seconds))
    ? Number(workout.duration_seconds)
    : null;
}

function getDistanceFromWorkout(workout) {
  const id = workout?.activity_id;
  if (id === 'wallball') return null;
  if (id === 'skierg' || id === 'rowing') {
    const v = Number(workout?.value);
    if (Number.isFinite(v) && v >= LEGACY_ERG_METERS_THRESHOLD) return v;
    return null;
  }
  if (Number.isFinite(Number(workout?.distance_km))) return Number(workout.distance_km) * 1000;
  if (Number.isFinite(Number(workout?.distance_m))) return Number(workout.distance_m);
  if (!workout?.is_lift && !workout?.is_hyrox && Number.isFinite(Number(workout?.value))) return Number(workout.value);
  return null;
}

function getErgSplitSecondsFromWorkout(workout) {
  const id = workout?.activity_id;
  if (id !== 'skierg' && id !== 'rowing') return null;
  const v = Number(workout?.value);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v < LEGACY_ERG_METERS_THRESHOLD) return v;
  return null;
}

function getPaceFromWorkout(workout) {
  if (workout?.pace_per_unit === null || workout?.pace_per_unit === undefined || workout?.pace_per_unit === '') return null;
  return Number.isFinite(Number(workout?.pace_per_unit)) ? Number(workout.pace_per_unit) : null;
}

function getWeightFromWorkout(workout) {
  if (HIDE_WEIGHT_REPS_ACTIVITIES.has(workout?.activity_id)) return null;
  if (workout?.station_weight_lbs === null || workout?.station_weight_lbs === undefined || workout?.station_weight_lbs === '') return null;
  if (Number.isFinite(Number(workout?.station_weight_lbs))) return Number(workout.station_weight_lbs);
  return null;
}

function getRepsFromWorkout(workout) {
  if (HIDE_WEIGHT_REPS_ACTIVITIES.has(workout?.activity_id)) return null;
  if (workout?.station_reps === null || workout?.station_reps === undefined || workout?.station_reps === '') return null;
  if (Number.isFinite(Number(workout?.station_reps))) return Number(workout.station_reps);
  return null;
}

function renderValueLabel(name, value, workout, distanceUnit) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (name === 'distance') {
    if (workout?.activity_id === 'run') {
      const unit = distanceUnit === 'miles' ? 'mi' : 'km';
      const base = distanceUnit === 'miles' ? value / 1609.344 : value / 1000;
      return `${base.toFixed(1)}${unit}`;
    }
    return `${Math.round(value)}m`;
  }
  if (name === 'duration') return formatDuration(value) || '—';
  if (name === 'split500') return `${formatDuration(value) || '—'}/500m`;
  if (name === 'pace') return `${value.toFixed(2)} min/${workout?.activity_id === 'run' ? (distanceUnit === 'miles' ? 'mi' : 'km') : 'm'}`;
  if (name === 'weight') return `${Math.round(value)}lbs`;
  if (name === 'reps') return `${Math.round(value)} reps`;
  return String(value);
}

function formatChartAxisValue(value, metric, workout, distanceUnit) {
  if (metric === 'duration') return formatDuration(value) || '';
  if (metric === 'distance' && workout?.activity_id === 'run') {
    const converted = distanceUnit === 'miles' ? value / 1609.344 : value / 1000;
    return `${converted.toFixed(1)}${distanceUnit === 'miles' ? 'mi' : 'km'}`;
  }
  return `${Math.round(value)}`;
}

function formatChartTooltipValue(value, metric, workout, distanceUnit) {
  if (metric === 'duration') return formatDuration(value) || value;
  if (metric === 'distance' && workout?.activity_id === 'run') {
    const converted = distanceUnit === 'miles' ? value / 1609.344 : value / 1000;
    return `${converted.toFixed(2)} ${distanceUnit === 'miles' ? 'mi' : 'km'}`;
  }
  return value;
}

function chartMetricLabel(metric, workout, distanceUnit) {
  if (metric === 'duration') return 'Duration';
  if (metric === 'weight') return 'Weight (lbs)';
  if (metric === 'reps') return 'Reps';
  if (metric === 'distance') {
    if (workout?.activity_id === 'run') return `Distance (${distanceUnit === 'miles' ? 'mi' : 'km'})`;
    return 'Distance (m)';
  }
  return 'Measurement';
}

function impactFromPct(pct) {
  if (pct < 15) return { impact: 'MICRO INVESTMENT', impactLevel: 0 };
  if (pct < 25) return { impact: 'LIGHT DAY', impactLevel: 1 };
  if (pct < 50) return { impact: 'GOOD WORKOUT', impactLevel: 2 };
  if (pct < 65) return { impact: 'STRONG SESSION', impactLevel: 3 };
  if (pct < 75) return { impact: 'GREAT SESSION', impactLevel: 4 };
  return { impact: 'NEEDLE MOVER', impactLevel: 5 };
}

function toShortDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function metricForHistoryPoint(metric, point, workout) {
  if (metric === 'weight') return point.maxWeightLbs ?? point.weightLbs ?? null;
  if (metric === 'duration') return point.durationSeconds ?? null;
  if (metric === 'reps') return point.reps ?? point.distanceOrReps ?? null;
  if (metric === 'distance') {
    if (workout?.activity_id === 'run') {
      if (Number.isFinite(Number(point.distanceKm))) return Number(point.distanceKm) * 1000;
    }
    if (Number.isFinite(Number(point.distanceM))) return Number(point.distanceM);
    return point.distanceOrReps ?? null;
  }
  return null;
}

function getMetricChoices(workout, history) {
  if (!workout) return { defaultMetric: 'distance', metrics: ['distance'] };
  if (workout.is_lift) return { defaultMetric: 'weight', metrics: ['weight'] };
  if (workout.is_hyrox) return { defaultMetric: 'duration', metrics: ['duration'] };

  const repsCount = history.filter((x) => Number.isFinite(Number(x.reps))).length;
  const distanceCount = history.filter((x) =>
    Number.isFinite(Number(x.distanceM)) || Number.isFinite(Number(x.distanceKm)) || Number.isFinite(Number(x.distanceOrReps))
  ).length;
  const weightCount = history.filter((x) => Number.isFinite(Number(x.weightLbs))).length;

  const id = workout.activity_id;
  if (id === 'burpee') return { defaultMetric: 'distance', metrics: repsCount >= 2 ? ['distance', 'reps'] : ['distance'] };
  if (id === 'sandbag') return { defaultMetric: 'distance', metrics: repsCount >= 2 ? ['distance', 'reps'] : ['distance'] };
  if (id === 'sledpush' || id === 'sledpull') {
    return { defaultMetric: 'weight', metrics: distanceCount >= 2 ? ['weight', 'distance'] : ['weight'] };
  }
  if (id === 'wallball') return { defaultMetric: 'reps', metrics: ['reps'] };
  if (id === 'run' || id === 'skierg' || id === 'rowing' || id === 'farmers') return { defaultMetric: 'distance', metrics: ['distance'] };
  if (weightCount >= 2 && distanceCount >= 2) return { defaultMetric: 'distance', metrics: ['distance', 'weight'] };
  return { defaultMetric: 'distance', metrics: ['distance'] };
}

const HYROX_LENGTH_OPTIONS = [
  { id: 'quarter', label: 'Quarter' },
  { id: 'half', label: 'Half' },
  { id: 'full', label: 'Full' },
];
const HIDE_WEIGHT_REPS_ACTIVITIES = new Set(['run', 'burpee', 'rowing', 'skierg']);

function buildWorkoutEditDraft(workout, distanceUnit, weightUnit) {
  if (!workout) return null;
  if (workout.is_lift) {
    const kg = Number(workout.lift_weight_kg);
    const displayWt =
      weightUnit === 'lbs' && Number.isFinite(kg)
        ? String(Math.round(kg * 2.205))
        : Number.isFinite(kg)
          ? String(kg)
          : '';
    return {
      kind: 'lift',
      heavy: workout.heavy === true,
      liftWeight: displayWt,
      lift_sets: workout.lift_sets != null ? String(workout.lift_sets) : '',
      lift_reps: workout.lift_reps != null ? String(workout.lift_reps) : '',
    };
  }
  if (workout.is_hyrox) {
    return {
      kind: 'hyrox',
      hyrox_length: workout.hyrox_length || 'full',
      hyrox_intensity: workout.hyrox_intensity === 'hard' ? 'hard' : 'easy',
      duration_seconds: workout.duration_seconds != null ? String(workout.duration_seconds) : '',
    };
  }
  const id = workout.activity_id;
  const isErg = id === 'skierg' || id === 'rowing';
  const v = Number(workout.value);
  let ergPace = false;
  let ergMm = '';
  let ergSs = '';
  let primary = '';
  if (isErg && Number.isFinite(v) && v > 0 && v < LEGACY_ERG_METERS_THRESHOLD) {
    ergPace = true;
    ergMm = String(Math.floor(v / 60));
    ergSs = String(Math.round(v % 60));
  } else if (isErg && Number.isFinite(v) && v >= LEGACY_ERG_METERS_THRESHOLD) {
    ergPace = false;
    primary = String(Math.round(v));
  } else if (id === 'wallball') {
    primary = Number.isFinite(v) ? String(v) : '';
  } else if (id === 'run') {
    let meters = null;
    if (Number.isFinite(Number(workout.distance_km))) meters = Number(workout.distance_km) * 1000;
    else if (Number.isFinite(Number(workout.distance_m))) meters = Number(workout.distance_m);
    else if (Number.isFinite(v)) meters = v;
    if (meters != null) {
      const display = distanceUnit === 'miles' ? meters / 1609.344 : meters / 1000;
      primary = String(Math.round(display * 1000) / 1000);
    }
  } else {
    let meters = null;
    if (Number.isFinite(Number(workout.distance_m))) meters = Number(workout.distance_m);
    else if (Number.isFinite(Number(workout.distance_km))) meters = Number(workout.distance_km) * 1000;
    else if (Number.isFinite(v)) meters = v;
    if (meters != null) primary = String(Math.round(meters));
  }
  return {
    kind: 'station',
    activity_id: id,
    hard: !!workout.hard,
    ergPace,
    ergMm,
    ergSs,
    primary,
    duration_seconds: workout.duration_seconds != null ? String(workout.duration_seconds) : '',
    pace_per_unit: workout.pace_per_unit !== null && workout.pace_per_unit !== undefined && workout.pace_per_unit !== '' && Number.isFinite(Number(workout.pace_per_unit))
      ? String(workout.pace_per_unit)
      : '',
    station_weight_lbs: workout.station_weight_lbs !== null && workout.station_weight_lbs !== undefined && workout.station_weight_lbs !== '' && Number.isFinite(Number(workout.station_weight_lbs))
      ? String(Math.round(workout.station_weight_lbs))
      : '',
    station_reps: workout.station_reps != null ? String(workout.station_reps) : '',
  };
}

function buildUpdatePatchFromDraft(workout, draft, distanceUnit, weightUnit) {
  if (!draft || !workout) return { patch: null, error: 'Missing data' };
  if (draft.kind === 'lift') {
    const w = draft.liftWeight.trim();
    let lift_weight_kg = null;
    if (w !== '') {
      const n = parseFloat(w);
      if (!Number.isFinite(n) || n <= 0) return { patch: null, error: 'Enter a valid weight.' };
      lift_weight_kg = weightUnit === 'lbs' ? n / 2.205 : n;
    }
    const setsStr = draft.lift_sets.trim();
    const repsStr = draft.lift_reps.trim();
    let lift_sets = null;
    let lift_reps = null;
    if (setsStr !== '') {
      lift_sets = parseInt(setsStr, 10);
      if (!Number.isFinite(lift_sets) || lift_sets < 1) return { patch: null, error: 'Sets must be a positive number.' };
    }
    if (repsStr !== '') {
      lift_reps = parseInt(repsStr, 10);
      if (!Number.isFinite(lift_reps) || lift_reps < 1) return { patch: null, error: 'Reps must be a positive number.' };
    }
    return {
      patch: {
        heavy: draft.heavy,
        lift_weight_kg,
        lift_sets,
        lift_reps,
      },
      error: null,
    };
  }
  if (draft.kind === 'hyrox') {
    const ds = draft.duration_seconds.trim();
    let duration_seconds = null;
    if (ds !== '') {
      const t = parseInt(ds, 10);
      if (!Number.isFinite(t) || t < 0) return { patch: null, error: 'Duration must be seconds (0+).' };
      duration_seconds = t;
    }
    return {
      patch: {
        hyrox_length: draft.hyrox_length,
        hyrox_intensity: draft.hyrox_intensity,
        duration_seconds,
      },
      error: null,
    };
  }
  const id = workout.activity_id;
  const patch = { hard: draft.hard };
  if (id === 'skierg' || id === 'rowing') {
    if (draft.ergPace) {
      const mm = parseInt(draft.ergMm, 10) || 0;
      const ss = parseInt(draft.ergSs, 10) || 0;
      if (ss < 0 || ss > 59) return { patch: null, error: 'Split seconds must be 0–59.' };
      const sec = mm * 60 + ss;
      if (sec <= 0) return { patch: null, error: 'Enter a valid 500m split.' };
      patch.value = sec;
      patch.distance_km = null;
      patch.distance_m = null;
    } else {
      const m = parseFloat(draft.primary);
      if (!Number.isFinite(m) || m <= 0) return { patch: null, error: 'Enter a valid distance (meters).' };
      patch.value = m;
    }
  } else if (id === 'run') {
    const n = parseFloat(draft.primary);
    if (!Number.isFinite(n) || n <= 0) return { patch: null, error: 'Enter a valid distance.' };
    const meters = distanceUnit === 'miles' ? n * 1609.344 : n * 1000;
    patch.value = meters;
    patch.distance_km = meters / 1000;
    patch.distance_m = null;
  } else if (id === 'wallball') {
    const r = parseInt(draft.primary, 10);
    if (!Number.isFinite(r) || r <= 0) return { patch: null, error: 'Enter valid reps.' };
    patch.value = r;
  } else {
    const m = parseFloat(draft.primary);
    if (!Number.isFinite(m) || m <= 0) return { patch: null, error: 'Enter a valid distance (meters).' };
    patch.value = m;
    patch.distance_m = m;
    patch.distance_km = null;
  }
  const dur = draft.duration_seconds.trim();
  if (dur === '') {
    patch.duration_seconds = null;
  } else {
    const t = parseInt(dur, 10);
    if (!Number.isFinite(t) || t < 0) return { patch: null, error: 'Time must be seconds (0+).' };
    patch.duration_seconds = t;
  }
  const pace = draft.pace_per_unit.trim();
  if (pace === '') {
    patch.pace_per_unit = null;
  } else {
    const p = parseFloat(pace);
    if (!Number.isFinite(p) || p <= 0) return { patch: null, error: 'Pace must be a positive number.' };
    patch.pace_per_unit = p;
  }
  if (!HIDE_WEIGHT_REPS_ACTIVITIES.has(id)) {
    const wl = draft.station_weight_lbs.trim();
    if (wl === '') {
      patch.station_weight_lbs = null;
    } else {
      const x = parseFloat(wl);
      if (!Number.isFinite(x) || x <= 0) return { patch: null, error: 'Station weight must be positive.' };
      patch.station_weight_lbs = x;
    }
    const sr = draft.station_reps.trim();
    if (sr === '') {
      patch.station_reps = null;
    } else {
      const r = parseInt(sr, 10);
      if (!Number.isFinite(r) || r < 1) return { patch: null, error: 'Station reps must be a positive number.' };
      patch.station_reps = r;
    }
  }
  return { patch, error: null };
}

export default function WorkoutDetailSheet({
  open,
  workout,
  workouts,
  userId,
  onClose,
  distanceUnit = 'km',
  weightUnit = 'kg',
  profile = null,
  onUpdateWorkout,
}) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [currentSets, setCurrentSets] = useState([]);
  const [previousSets, setPreviousSets] = useState([]);
  const [isPR, setIsPR] = useState(false);
  const [history, setHistory] = useState([]);
  const [metric, setMetric] = useState('distance');

  const maxPts = useMemo(
    () => Math.max(0, ...(workouts || []).map((w) => getWorkoutSessionPoints(w, { profile }))),
    [workouts, profile]
  );

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setSaveError(null);
      setDraft(null);
    }
  }, [open]);

  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setDraft(null);
  }, [workout?.id]);

  useEffect(() => {
    if (!open || !workout || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prevBundle = await getPreviousWorkout(supabase, userId, workout);
      const currentVolume = computeLiftSessionVolume(workout, prevBundle.currentSets);
      const [pr, chartHistory] = await Promise.all([
        getPRStatus(supabase, userId, workout, currentVolume),
        getHistoricalMaxWeights(supabase, userId, workout),
      ]);

      if (cancelled) return;
      setPrevious(prevBundle.previous);
      setCurrentSets(prevBundle.currentSets || []);
      setPreviousSets(prevBundle.previousSets || []);
      setIsPR(pr);
      setHistory(chartHistory || []);
      const { defaultMetric } = getMetricChoices(workout, chartHistory || []);
      setMetric(defaultMetric);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, workout, userId]);

  if (!workout) return null;

  async function handleSaveEdit() {
    if (!onUpdateWorkout || !draft) return;
    const { patch, error: buildErr } = buildUpdatePatchFromDraft(workout, draft, distanceUnit, weightUnit);
    if (buildErr) {
      setSaveError(buildErr);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const { error } = await onUpdateWorkout(workout.id, patch);
    setSaving(false);
    if (error) {
      setSaveError(error.message || 'Could not save');
      return;
    }
    setEditing(false);
    setDraft(null);
  }

  function startEditing() {
    setDraft(buildWorkoutEditDraft(workout, distanceUnit, weightUnit));
    setEditing(true);
    setSaveError(null);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  }

  const pts = getWorkoutSessionPoints(workout, { profile });
  const pct = maxPts > 0 ? Math.min((pts / maxPts) * 100, 100) : 0;
  const impact = impactFromPct(pct);

  const comparisonRows = (() => {
    if (!previous) return [];
    if (workout.is_lift) {
      const currentMax = getLiftMaxLbs(workout, currentSets);
      const prevMax = getLiftMaxLbs(previous, previousSets);
      const currentVol = computeLiftSessionVolume(workout, currentSets);
      const prevVol = computeLiftSessionVolume(previous, previousSets);
      const currentSetCount = currentSets.length || Number(workout.lift_sets || 0);
      const prevSetCount = previousSets.length || Number(previous.lift_sets || 0);
      const currentAvgReps = currentSetCount > 0 ? Number(workout.lift_reps || 0) / currentSetCount : 0;
      const prevAvgReps = prevSetCount > 0 ? Number(previous.lift_reps || 0) / prevSetCount : 0;
      return [
        { name: 'Max weight', current: currentMax, previous: prevMax, type: 'weight' },
        { name: 'Total volume', current: currentVol, previous: prevVol, type: 'weight' },
        { name: 'Sets', current: currentSetCount, previous: prevSetCount, type: 'plain' },
        { name: 'Avg reps/set', current: currentAvgReps, previous: prevAvgReps, type: 'plain' },
      ];
    }
    if (workout.is_hyrox) {
      return [
        { name: 'Duration', current: getDurationFromWorkout(workout), previous: getDurationFromWorkout(previous), type: 'duration', reverseGood: true },
      ];
    }
    if (workout.activity_id === 'skierg' || workout.activity_id === 'rowing') {
      const curS = getErgSplitSecondsFromWorkout(workout);
      const prevS = getErgSplitSecondsFromWorkout(previous);
      if (curS !== null && prevS !== null) {
        return [
          { name: '500m split', current: curS, previous: prevS, type: 'split500', reverseGood: true },
        ];
      }
    }
    const rows = [
      { name: 'Distance', current: getDistanceFromWorkout(workout), previous: getDistanceFromWorkout(previous), type: 'distance' },
      { name: 'Time', current: getDurationFromWorkout(workout), previous: getDurationFromWorkout(previous), type: 'duration', reverseGood: true },
      { name: 'Pace', current: getPaceFromWorkout(workout), previous: getPaceFromWorkout(previous), type: 'pace', reverseGood: true },
      { name: 'Weight', current: getWeightFromWorkout(workout), previous: getWeightFromWorkout(previous), type: 'weight' },
      { name: 'Reps', current: getRepsFromWorkout(workout), previous: getRepsFromWorkout(previous), type: 'reps' },
    ];
    return rows.filter((r) => Number.isFinite(r.current) && Number.isFinite(r.previous));
  })();

  const summary = (() => {
    if (!previous || comparisonRows.length === 0) return null;
    const primary = comparisonRows[0];
    const change = pctChange(primary.current, primary.previous);
    if (change === null) return null;
    const up = (primary.reverseGood ? change < 0 : change > 0);
    const magnitude = Math.abs(change).toFixed(1);
    const verb = up ? 'improved' : 'changed';
    return {
      text: `${verb} ${magnitude}% vs last time`,
      up,
    };
  })();

  const { metrics } = getMetricChoices(workout, history);
  const chartData = history
    .map((p) => ({
      date: toShortDate(p.date),
      value: metricForHistoryPoint(metric, p, workout),
    }))
    .filter((p) => Number.isFinite(Number(p.value)));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Workout Details"
      scrollContent
    >
      <div className={styles.section}>
        <button type="button" className={styles.closeBtn} onClick={onClose}>Close</button>
        <div className={styles.headerRow}>
          <span className={styles.icon}>{workoutIcon(workout)}</span>
          <div>
            <h3 className={styles.title}>{workoutTitle(workout, distanceUnit)}</h3>
            <p className={styles.sub}>{formatDate(workout.logged_at)}</p>
          </div>
        </div>
        <div className={styles.impactTrack}>
          <div className={styles.impactFill} style={{ width: `${Math.round(pct)}%` }} />
        </div>
        <p className={styles.impactLabel}>{impact.impact}</p>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{editing ? 'Edit session' : 'This session'}</h4>
        {editing && draft ? (
          <div className={styles.editForm}>
            {draft.kind === 'lift' && (
              <>
                {currentSets.length > 0 && (
                  <p className={styles.formHint}>
                    This workout has per-set data. Saving updates the summary only; set rows in the database are unchanged.
                  </p>
                )}
                <p className={styles.formLabel}>Load</p>
                <div className={styles.hardPickRow}>
                  <button
                    type="button"
                    className={`${styles.pickBtn} ${draft.heavy ? styles.pickBtnActive : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, heavy: true }))}
                  >
                    Heavy · near max effort
                  </button>
                  <button
                    type="button"
                    className={`${styles.pickBtn} ${!draft.heavy ? styles.pickBtnActive : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, heavy: false }))}
                  >
                    Light · working weight
                  </button>
                </div>
                <label className={styles.field}>
                  <span>Weight ({weightUnit})</span>
                  <input
                    className={styles.formInput}
                    value={draft.liftWeight}
                    onChange={(e) => setDraft((d) => ({ ...d, liftWeight: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className={styles.field}>
                  <span>Sets</span>
                  <input
                    className={styles.formInput}
                    value={draft.lift_sets}
                    onChange={(e) => setDraft((d) => ({ ...d, lift_sets: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
                <label className={styles.field}>
                  <span>Reps (total)</span>
                  <input
                    className={styles.formInput}
                    value={draft.lift_reps}
                    onChange={(e) => setDraft((d) => ({ ...d, lift_reps: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
              </>
            )}
            {draft.kind === 'hyrox' && (
              <>
                <p className={styles.formLabel}>Session length</p>
                <div className={styles.lengthPickRow}>
                  {HYROX_LENGTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`${styles.pickBtn} ${draft.hyrox_length === opt.id ? styles.pickBtnActive : ''}`}
                      onClick={() => setDraft((d) => ({ ...d, hyrox_length: opt.id }))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className={styles.formLabel}>Intensity</p>
                <div className={styles.hardPickRow}>
                  <button
                    type="button"
                    className={`${styles.pickBtn} ${draft.hyrox_intensity === 'easy' ? styles.pickBtnActive : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, hyrox_intensity: 'easy' }))}
                  >
                    {LABEL_INTENSITY_COMFORTABLE}
                  </button>
                  <button
                    type="button"
                    className={`${styles.pickBtn} ${draft.hyrox_intensity === 'hard' ? styles.pickBtnActive : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, hyrox_intensity: 'hard' }))}
                  >
                    {LABEL_INTENSITY_CHALLENGING}
                  </button>
                </div>
                <label className={styles.field}>
                  <span>Duration (seconds, optional)</span>
                  <input
                    className={styles.formInput}
                    value={draft.duration_seconds}
                    onChange={(e) => setDraft((d) => ({ ...d, duration_seconds: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
              </>
            )}
            {draft.kind === 'station' && (
              <>
                <p className={styles.formLabel}>How did it feel?</p>
                <div className={styles.hardPickRow}>
                  <button
                    type="button"
                    className={`${styles.pickBtn} ${draft.hard === true ? styles.pickBtnActive : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, hard: true }))}
                  >
                    {LABEL_INTENSITY_CHALLENGING}
                  </button>
                  <button
                    type="button"
                    className={`${styles.pickBtn} ${draft.hard === false ? styles.pickBtnActive : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, hard: false }))}
                  >
                    {LABEL_INTENSITY_COMFORTABLE}
                  </button>
                </div>
                {(draft.activity_id === 'skierg' || draft.activity_id === 'rowing') && (
                  <>
                    <p className={styles.formLabel}>Erg entry</p>
                    <div className={styles.toggleRow}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${draft.ergPace ? styles.toggleBtnActive : ''}`}
                        onClick={() => setDraft((d) => ({ ...d, ergPace: true }))}
                      >
                        500m split
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${!draft.ergPace ? styles.toggleBtnActive : ''}`}
                        onClick={() => setDraft((d) => ({ ...d, ergPace: false }))}
                      >
                        Distance (m)
                      </button>
                    </div>
                    {draft.ergPace ? (
                      <div className={styles.splitRow}>
                        <label className={styles.field}>
                          <span>Min</span>
                          <input
                            className={styles.formInput}
                            value={draft.ergMm}
                            onChange={(e) => setDraft((d) => ({ ...d, ergMm: e.target.value }))}
                            inputMode="numeric"
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Sec</span>
                          <input
                            className={styles.formInput}
                            value={draft.ergSs}
                            onChange={(e) => setDraft((d) => ({ ...d, ergSs: e.target.value }))}
                            inputMode="numeric"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className={styles.field}>
                        <span>Distance (meters)</span>
                        <input
                          className={styles.formInput}
                          value={draft.primary}
                          onChange={(e) => setDraft((d) => ({ ...d, primary: e.target.value }))}
                          inputMode="decimal"
                        />
                      </label>
                    )}
                  </>
                )}
                {draft.activity_id !== 'skierg' && draft.activity_id !== 'rowing' && (
                  <label className={styles.field}>
                    <span>
                      {draft.activity_id === 'wallball'
                        ? 'Reps'
                        : draft.activity_id === 'run'
                          ? (distanceUnit === 'miles' ? 'Distance (mi)' : 'Distance (km)')
                          : 'Distance (meters)'}
                    </span>
                    <input
                      className={styles.formInput}
                      value={draft.primary}
                      onChange={(e) => setDraft((d) => ({ ...d, primary: e.target.value }))}
                      inputMode="decimal"
                    />
                  </label>
                )}
                <label className={styles.field}>
                  <span>Duration (seconds, optional)</span>
                  <input
                    className={styles.formInput}
                    value={draft.duration_seconds}
                    onChange={(e) => setDraft((d) => ({ ...d, duration_seconds: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
                <label className={styles.field}>
                  <span>Pace (optional)</span>
                  <input
                    className={styles.formInput}
                    value={draft.pace_per_unit}
                    onChange={(e) => setDraft((d) => ({ ...d, pace_per_unit: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                {!HIDE_WEIGHT_REPS_ACTIVITIES.has(draft.activity_id) && (
                  <>
                    <label className={styles.field}>
                      <span>Station weight (lbs, optional)</span>
                      <input
                        className={styles.formInput}
                        value={draft.station_weight_lbs}
                        onChange={(e) => setDraft((d) => ({ ...d, station_weight_lbs: e.target.value }))}
                        inputMode="decimal"
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Station reps (optional)</span>
                      <input
                        className={styles.formInput}
                        value={draft.station_reps}
                        onChange={(e) => setDraft((d) => ({ ...d, station_reps: e.target.value }))}
                        inputMode="numeric"
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </div>
        ) : workout.is_lift ? (
          currentSets.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr><th>Set</th><th>Per side (lbs)</th><th>Total (lbs)</th><th>Reps</th></tr>
              </thead>
              <tbody>
                {currentSets.map((s) => {
                  // lift_sets.weight_kg stores TOTAL barbell weight, not per-side plate weight.
                  const totalLbsRaw = Number(s.weight_kg || 0) * 2.205;
                  const perSide = Math.max(0, Math.round((totalLbsRaw - 45) / 2));
                  const total = (perSide * 2) + 45;
                  return (
                    <tr key={s.id}>
                      <td>{s.set_number}</td>
                      <td>{perSide}</td>
                      <td>{total}</td>
                      <td>{s.reps}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className={styles.kvList}>
              <div className={styles.kv}><span>Weight</span><span>{Math.round(Number(workout.lift_weight_kg || 0) * 2.205)}lbs</span></div>
              <div className={styles.kv}><span>Sets</span><span>{workout.lift_sets ?? '—'}</span></div>
              <div className={styles.kv}><span>Reps</span><span>{workout.lift_reps ?? '—'}</span></div>
            </div>
          )
        ) : (
          <div className={styles.kvList}>
            {(workout.activity_id === 'skierg' || workout.activity_id === 'rowing') &&
              Number(workout.value) > 0 &&
              Number(workout.value) < LEGACY_ERG_METERS_THRESHOLD && (
                <div className={styles.kv}><span>500m split</span><span>{formatDuration(Number(workout.value))}</span></div>
            )}
            {(workout.activity_id === 'skierg' || workout.activity_id === 'rowing') &&
              Number(workout.value) >= LEGACY_ERG_METERS_THRESHOLD && (
                <div className={styles.kv}><span>Distance</span><span>{Math.round(Number(workout.value))}m</span></div>
            )}
            {workout.activity_id !== 'skierg' && workout.activity_id !== 'rowing' && Number.isFinite(Number(workout.distance_km)) && <div className={styles.kv}><span>Distance</span><span>{Number(workout.distance_km).toFixed(2)}km</span></div>}
            {workout.activity_id !== 'skierg' && workout.activity_id !== 'rowing' && Number.isFinite(Number(workout.distance_m)) && <div className={styles.kv}><span>Distance</span><span>{Math.round(Number(workout.distance_m))}m</span></div>}
            {formatDuration(workout.duration_seconds) && <div className={styles.kv}><span>Time</span><span>{formatDuration(workout.duration_seconds)}</span></div>}
            {workout.pace_per_unit !== null && workout.pace_per_unit !== undefined && workout.pace_per_unit !== '' && Number.isFinite(Number(workout.pace_per_unit)) && <div className={styles.kv}><span>Pace</span><span>{Number(workout.pace_per_unit).toFixed(2)}</span></div>}
            {!HIDE_WEIGHT_REPS_ACTIVITIES.has(workout.activity_id) && workout.station_weight_lbs !== null && workout.station_weight_lbs !== undefined && workout.station_weight_lbs !== '' && Number.isFinite(Number(workout.station_weight_lbs)) && <div className={styles.kv}><span>Weight</span><span>{Math.round(Number(workout.station_weight_lbs))}lbs</span></div>}
            {!HIDE_WEIGHT_REPS_ACTIVITIES.has(workout.activity_id) && workout.station_reps !== null && workout.station_reps !== undefined && workout.station_reps !== '' && Number.isFinite(Number(workout.station_reps)) && <div className={styles.kv}><span>Reps</span><span>{Math.round(Number(workout.station_reps))}</span></div>}
            {workout.is_hyrox && <div className={styles.kv}><span>Length</span><span>{workout.hyrox_length || '—'}</span></div>}
            {workout.is_hyrox && (
              <div className={styles.kv}>
                <span>Intensity</span>
                <span>
                  {workout.hyrox_intensity === 'hard'
                    ? LABEL_INTENSITY_CHALLENGING
                    : workout.hyrox_intensity === 'easy'
                      ? LABEL_INTENSITY_COMFORTABLE
                      : (workout.hyrox_intensity || '—')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Comparison vs last time</h4>
        {loading ? (
          <p className={styles.muted}>Loading...</p>
        ) : !previous ? (
          <p className={styles.muted}>First time doing this — great start!</p>
        ) : (
          <>
            {isPR && (
              <div className={styles.prBanner}>
                <strong>🏆 Personal Record</strong>
                <span>Best total volume for this exercise</span>
              </div>
            )}
            {summary && (
              <p className={`${styles.summary} ${summary.up ? styles.good : styles.bad}`}>
                {summary.text}
              </p>
            )}
            <table className={styles.table}>
              <thead>
                <tr><th>Stat</th><th>Last time</th><th>Today</th><th>%</th></tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => {
                  const change = pctChange(row.current, row.previous);
                  const improved = row.reverseGood ? change < 0 : change > 0;
                  return (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{renderValueLabel(row.type === 'plain' ? 'reps' : row.type, row.previous, workout, distanceUnit)}</td>
                      <td>{renderValueLabel(row.type === 'plain' ? 'reps' : row.type, row.current, workout, distanceUnit)}</td>
                      <td>
                        <span className={`${styles.badge} ${improved ? styles.badgeUp : styles.badgeDown}`}>
                          {change === null ? '—' : `${improved ? '↑' : '↓'} ${formatPercent(Math.abs(change))}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Progress chart</h4>
        {metrics.length > 1 && (
          <div className={styles.toggleRow}>
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.toggleBtn} ${metric === m ? styles.toggleBtnActive : ''}`}
                onClick={() => setMetric(m)}
              >
                {m === 'weight' ? 'Weight' : m === 'distance' ? 'Distance' : m === 'reps' ? 'Reps' : m === 'duration' ? 'Duration' : m}
              </button>
            ))}
          </div>
        )}
        {chartData.length === 0 ? (
          <p className={styles.muted}>Not enough data yet.</p>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="date" stroke="#9b9b9b" tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#9b9b9b"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatChartAxisValue(value, metric, workout, distanceUnit)}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a1c', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  labelStyle={{ color: '#cfcfcf' }}
                  formatter={(value) => [formatChartTooltipValue(value, metric, workout, distanceUnit), chartMetricLabel(metric, workout, distanceUnit)]}
                />
                <Line type="monotone" dataKey="value" stroke="#d4f233" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            {workout.is_hyrox && <p className={styles.axisHint}>lower is better</p>}
          </div>
        )}
      </div>

      {onUpdateWorkout && (
        <div className={styles.editFooter}>
          {saveError && <p className={styles.editFooterError}>{saveError}</p>}
          <div className={styles.editFooterActions}>
            {!editing ? (
              <button type="button" className={styles.editTextLink} onClick={startEditing}>
                Edit workout
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.editTextLinkMuted}
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </button>
                <span className={styles.editFooterSep} aria-hidden>·</span>
                <button
                  type="button"
                  className={styles.editTextLink}
                  onClick={handleSaveEdit}
                  disabled={saving || !draft}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
