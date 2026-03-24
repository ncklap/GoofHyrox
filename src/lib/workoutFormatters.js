import {
  ACTIVITY_LABELS,
  ACTIVITY_ICONS,
  LIFT_LABELS,
  LIFT_ICONS,
  LEGACY_ERG_METERS_THRESHOLD,
  LABEL_INTENSITY_CHALLENGING,
  LABEL_INTENSITY_COMFORTABLE,
} from './constants.js';

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';

  const now = new Date();
  const diffMs = now - d;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function workoutIcon(w) {
  if (w.is_hyrox) return '🏁';
  if (w.is_lift) return LIFT_ICONS[w.lift_id] || '🏋️';
  return ACTIVITY_ICONS[w.activity_id] || '•';
}

function formatRunDistance(meters, distanceUnit) {
  if (meters === null || meters === undefined || meters === '') return '';
  const n = Number(meters);
  if (!Number.isFinite(n)) return '';
  if (distanceUnit === 'miles') {
    const miles = n / 1609.344;
    const rounded = Math.round(miles * 10) / 10;
    return rounded % 1 === 0 ? String(Math.round(rounded)) : String(rounded);
  }
  const km = n / 1000;
  const rounded1 = Math.round(km * 10) / 10;
  return rounded1 % 1 === 0 ? String(Math.round(rounded1)) : String(rounded1);
}

export function formatDuration(totalSeconds) {
  const n = Number(totalSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function workoutTitle(w, distanceUnit) {
  if (w.is_hyrox) {
    const len = w.hyrox_length === 'full' ? 'Full' : w.hyrox_length === 'half' ? 'Half' : 'Quarter';
    const feel = w.hyrox_intensity === 'hard' ? LABEL_INTENSITY_CHALLENGING : LABEL_INTENSITY_COMFORTABLE;
    return `Hyrox ${len} · ${feel}`;
  }
  if (w.is_lift) {
    const load = w.heavy ? 'Heavy' : 'Light';
    return `${LIFT_LABELS[w.lift_id] || w.lift_id} · ${load}`;
  }
  const label = ACTIVITY_LABELS[w.activity_id] || w.activity_id;
  const feel = w.hard ? LABEL_INTENSITY_CHALLENGING : LABEL_INTENSITY_COMFORTABLE;
  const bits = [label];

  if (Number.isFinite(Number(w.distance_km)) && Number(w.distance_km) > 0) {
    const meters = Number(w.distance_km) * 1000;
    bits.push(`${formatRunDistance(meters, distanceUnit)}${distanceUnit === 'miles' ? 'mi' : 'km'}`);
  } else if (Number.isFinite(Number(w.distance_m)) && Number(w.distance_m) > 0) {
    bits.push(`${Math.round(Number(w.distance_m))}m`);
  } else if (w.value !== null && w.value !== undefined && w.value !== '') {
    if (w.activity_id === 'skierg' || w.activity_id === 'rowing') {
      const v = Number(w.value);
      if (Number.isFinite(v) && v > 0 && v < LEGACY_ERG_METERS_THRESHOLD) {
        bits.push(`${formatDuration(v)}/500m`);
      } else {
        bits.push(`${w.value}m`);
      }
    } else {
      const unit = w.activity_id === 'wallball' ? 'reps' : w.activity_id === 'run' ? (distanceUnit === 'miles' ? 'mi' : 'km') : 'm';
      const valueDisplay = w.activity_id === 'run' ? formatRunDistance(w.value, distanceUnit) : w.value;
      bits.push(`${valueDisplay}${unit}`);
    }
  }

  const duration = formatDuration(w.duration_seconds);
  if (duration) bits.push(duration);

  if (Number.isFinite(Number(w.pace_per_unit)) && Number(w.pace_per_unit) > 0) {
    const totalSec = Math.round(Number(w.pace_per_unit) * 60);
    const pm = Math.floor(totalSec / 60);
    const ps = totalSec % 60;
    const paceUnit = w.activity_id === 'run' ? (distanceUnit === 'miles' ? 'mi' : 'km') : 'm';
    bits.push(`${pm}:${String(ps).padStart(2, '0')}/${paceUnit}`);
  }

  if (Number.isFinite(Number(w.station_weight_lbs)) && Number(w.station_weight_lbs) > 0) {
    bits.push(`${Math.round(Number(w.station_weight_lbs))}lbs`);
  }
  if (Number.isFinite(Number(w.station_reps)) && Number(w.station_reps) > 0) {
    bits.push(`${Math.round(Number(w.station_reps))} reps`);
  }

  bits.push(feel);
  return bits.join(' · ');
}

export function liftTrackingMeta(w, weightUnit) {
  if (!w?.is_lift) return null;

  const parts = [];
  const weightNum = w.lift_weight_kg !== null && w.lift_weight_kg !== undefined && w.lift_weight_kg !== ''
    ? Number(w.lift_weight_kg)
    : null;
  if (weightNum !== null && Number.isFinite(weightNum)) {
    if (weightUnit === 'lbs') {
      parts.push(`${Math.round(weightNum * 2.205)}lbs`);
    } else {
      parts.push(`${Math.round(weightNum)}kg`);
    }
  }

  const setsNum = w.lift_sets !== null && w.lift_sets !== undefined && w.lift_sets !== ''
    ? Number(w.lift_sets)
    : null;
  const repsNum = w.lift_reps !== null && w.lift_reps !== undefined && w.lift_reps !== ''
    ? Number(w.lift_reps)
    : null;
  if (setsNum !== null && Number.isFinite(setsNum) && repsNum !== null && Number.isFinite(repsNum)) {
    parts.push(`${Math.round(setsNum)}×${Math.round(repsNum)}`);
  } else if (setsNum !== null && Number.isFinite(setsNum)) {
    parts.push(`${Math.round(setsNum)} sets`);
  } else if (repsNum !== null && Number.isFinite(repsNum)) {
    parts.push(`${Math.round(repsNum)} reps`);
  }

  if (parts.length === 0) return null;
  return parts.join(' · ');
}
