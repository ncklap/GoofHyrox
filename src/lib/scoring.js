import {
  ACTIVITIES,
  CATEGORIES,
  LIFTS,
  CATEGORY_SUM_MAX,
  ROW_SKI_TARGETS,
  DEFAULT_DIVISION_KEY,
  resolveDivisionKeyFromProfile,
  getDivisionTargets,
  LEGACY_ERG_METERS_THRESHOLD,
} from './constants.js';

const RECENCY_DAYS = 15;

/** Hyrox sim: fixed budget per length, split across categories by max weights */
export const HYROX_SESSION_POINTS = {
  full: 200,
  half: 80,
  quarter: 30,
};
const BAR_KG = 20;
const LBS_PER_KG = 2.205;

function isRecent(loggedAt) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENCY_DAYS);
  return new Date(loggedAt) >= cutoff;
}

function getRunBase(meters) {
  if (meters >= 8000) return 50;
  if (meters >= 5000) return 40;
  if (meters >= 1000) return 25;
  return 5;
}

/** Total session points for one Hyrox log (before category split) */
export function getHyroxSessionPoints(session) {
  const len = session?.hyrox_length;
  const base =
    len === 'full' ? HYROX_SESSION_POINTS.full :
      len === 'half' ? HYROX_SESSION_POINTS.half :
        HYROX_SESSION_POINTS.quarter;
  const effortMult = session?.hyrox_intensity === 'hard' ? 0.6 : 1.0;
  return base * effortMult;
}

function stationWeightKgFromWorkout(w) {
  if (Number.isFinite(Number(w?.station_weight_kg)) && Number(w.station_weight_kg) > 0) {
    return Number(w.station_weight_kg);
  }
  if (Number.isFinite(Number(w?.station_weight_lbs)) && Number(w.station_weight_lbs) > 0) {
    return Number(w.station_weight_lbs) / LBS_PER_KG;
  }
  return null;
}

/** Sled: optional per-side kg in DB → total bar + plates load */
function sledTotalKg(w) {
  const perSide = stationWeightKgFromWorkout(w);
  if (perSide === null) return null;
  return perSide * 2 + BAR_KG;
}

function volumeScoreFromRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return ratio >= 0.8 ? 1.0 : ratio;
}

function legacyErgPoints(w, activity, divisionKey) {
  const div = getDivisionTargets(divisionKey);
  const distTarget =
    activity.id === 'rowing'
      ? (div.row?.distance ?? 1000)
      : (div.ski_erg?.distance ?? 1000);
  const meters = Number(w.value);
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  const ratio = meters / distTarget;
  const volumeScore = volumeScoreFromRatio(ratio);
  const intensityMult = w.hard ? 0.6 : 1.0;
  return 50 * volumeScore * intensityMult;
}

function paceErgPoints(w, divisionKey) {
  const targetSplit =
    ROW_SKI_TARGETS[divisionKey] ?? ROW_SKI_TARGETS[DEFAULT_DIVISION_KEY];
  const actualSplit = Number(w.value);
  if (!Number.isFinite(actualSplit) || actualSplit <= 0) return 0;
  const ratio = targetSplit / actualSplit;
  const volumeScore = Math.min(Math.max(ratio, 0), 1);
  const intensityMult = w.hard ? 0.6 : 1.0;
  return 50 * volumeScore * intensityMult;
}

function computeStationSessionPoints(w, activity, profile) {
  const divisionKey = resolveDivisionKeyFromProfile(profile);
  const div = getDivisionTargets(divisionKey);
  const hard = !!w.hard;
  const intensityMultStation = hard ? 0.5 : 1.0;

  if (activity.id === 'run') {
    const base = getRunBase(w.value);
    const ratio = w.value / activity.target;
    const volumeScore = volumeScoreFromRatio(ratio);
    return base * volumeScore * intensityMultStation;
  }

  if (activity.id === 'skierg' || activity.id === 'rowing') {
    const val = Number(w.value);
    if (!Number.isFinite(val)) return 0;
    if (val >= LEGACY_ERG_METERS_THRESHOLD) {
      return legacyErgPoints(w, activity, divisionKey);
    }
    return paceErgPoints(w, divisionKey);
  }

  if (activity.id === 'burpee') {
    const targetM = div.burpee?.distance ?? activity.target;
    const ratio = Number(w.value) / targetM;
    const volumeScore = volumeScoreFromRatio(ratio);
    return 50 * volumeScore * intensityMultStation;
  }

  if (activity.id === 'wallball') {
    const targetReps = div.wall_balls?.reps ?? activity.target;
    const reps = Number(w.station_reps ?? w.value);
    if (!Number.isFinite(reps) || reps <= 0) return 0;
    const ratio = reps / targetReps;
    const volumeScore = volumeScoreFromRatio(ratio);
    return 50 * volumeScore * intensityMultStation;
  }

  if (activity.id === 'sledpush') {
    const targetKg = div.sled_push;
    const totalKg = sledTotalKg(w);
    let ratio;
    if (totalKg !== null && targetKg) {
      ratio = Math.min(1, totalKg / targetKg);
    } else {
      ratio = Number(w.value) / activity.target;
    }
    const volumeScore = volumeScoreFromRatio(ratio);
    return 50 * volumeScore * intensityMultStation;
  }

  if (activity.id === 'sledpull') {
    const targetKg = div.sled_pull;
    const totalKg = sledTotalKg(w);
    let ratio;
    if (totalKg !== null && targetKg) {
      ratio = Math.min(1, totalKg / targetKg);
    } else {
      ratio = Number(w.value) / activity.target;
    }
    const volumeScore = volumeScoreFromRatio(ratio);
    return 50 * volumeScore * intensityMultStation;
  }

  if (activity.id === 'farmers') {
    const targetKg = div.farmers_carry;
    const kg = stationWeightKgFromWorkout(w);
    let ratio;
    if (kg !== null && targetKg) {
      ratio = Math.min(1, kg / targetKg);
    } else {
      ratio = Number(w.value) / activity.target;
    }
    const volumeScore = volumeScoreFromRatio(ratio);
    return 50 * volumeScore * intensityMultStation;
  }

  if (activity.id === 'sandbag') {
    const targetKg = div.sandbag_lunges;
    const kg = stationWeightKgFromWorkout(w);
    let ratio;
    if (kg !== null && targetKg) {
      ratio = Math.min(1, kg / targetKg);
    } else {
      ratio = Number(w.value) / activity.target;
    }
    const volumeScore = volumeScoreFromRatio(ratio);
    return 50 * volumeScore * intensityMultStation;
  }

  const ratio = Number(w.value) / activity.target;
  const volumeScore = volumeScoreFromRatio(ratio);
  return 50 * volumeScore * intensityMultStation;
}

export function computeScores(workouts, options = {}) {
  const { profile = null } = options;
  const recentWorkouts = workouts.filter(w => isRecent(w.logged_at));

  const catScores = {};
  for (const cat of Object.keys(CATEGORIES)) {
    catScores[cat] = 0;
  }

  for (const activity of ACTIVITIES) {
    const sessions = recentWorkouts
      .filter(w => !w.is_lift && !w.is_hyrox && w.activity_id === activity.id)
      .map(w => computeStationSessionPoints(w, activity, profile))
      .sort((a, b) => b - a)
      .slice(0, activity.cap);

    catScores[activity.cat] += sessions.reduce((s, v) => s + v, 0);
  }

  for (const lift of LIFTS) {
    const sessions = recentWorkouts
      .filter(w => w.is_lift && w.lift_id === lift.id)
      .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
      .slice(0, 2);

    for (const session of sessions) {
      const totalPts = session.heavy ? 30 : 15;
      for (const [cat, pct] of Object.entries(lift.split)) {
        catScores[cat] += totalPts * pct;
      }
    }
  }

  const hyroxSessions = recentWorkouts.filter(w => w.is_hyrox);
  for (const session of hyroxSessions) {
    const sessionPts = getHyroxSessionPoints(session);
    for (const [cat, info] of Object.entries(CATEGORIES)) {
      catScores[cat] += sessionPts * (info.max / CATEGORY_SUM_MAX);
    }
  }

  for (const [cat, info] of Object.entries(CATEGORIES)) {
    catScores[cat] = Math.min(catScores[cat], info.max);
  }

  let total = Object.values(catScores).reduce((s, v) => s + v, 0);

  const coreZeros = Object.entries(CATEGORIES)
    .filter(([, info]) => info.core)
    .filter(([cat]) => catScores[cat] === 0)
    .length;

  if (coreZeros >= 2) {
    total = Math.min(total, 160);
  } else if (coreZeros === 1) {
    total = Math.min(total, 280);
  }

  return {
    categories: catScores,
    total: Math.round(total),
    coreZeros,
  };
}

/** Design-system verdict tone class (maps to CSS module classes) */
export function getVerdict(score, hasWorkouts) {
  if (!hasWorkouts && score === 0) {
    return {
      label: 'WHY ARE YOU HERE.',
      subtext: 'YOU ARE NOT READY.',
      color: 'var(--muted)',
      tone: 'onboarding',
    };
  }

  if (score >= 1 && score <= 20) {
    return { label: 'YOU WILL DIE', subtext: 'YOU ARE NOT READY.', color: 'var(--accent-red)', tone: 'notReady' };
  }
  if (score >= 21 && score <= 40) {
    return { label: "YOU'RE FUCKED", subtext: 'YOU ARE NOT READY.', color: 'var(--accent-red)', tone: 'notReady' };
  }
  if (score >= 41 && score <= 60) {
    return { label: 'YOU WILL GET INJURED', subtext: 'YOU ARE NOT READY.', color: 'var(--accent-red)', tone: 'notReady' };
  }
  if (score >= 61 && score <= 80) {
    return { label: "YOU'LL GET ZIPPED UP", subtext: 'YOU ARE NOT READY.', color: 'var(--accent-red)', tone: 'notReady' };
  }
  if (score >= 81 && score <= 100) {
    return { label: 'YOU SEE THE VISION', subtext: 'YOU ARE NOT READY.', color: 'var(--accent-red)', tone: 'notReady' };
  }
  if (score >= 101 && score <= 120) {
    return {
      label: 'FIX IT. OR GET LEFT BEHIND.',
      subtext: 'YOU ARE NOT READY.',
      color: 'var(--accent-red)',
      tone: 'notReady',
    };
  }
  if (score >= 121 && score <= 140) {
    return {
      label: 'PUT THE WORK IN. NO EXCUSES.',
      subtext: 'YOU ARE NOT READY.',
      color: 'var(--accent-red)',
      tone: 'notReady',
    };
  }
  if (score >= 141 && score <= 160) {
    return { label: 'EARN IT.', subtext: 'YOU ARE NOT READY.', color: 'var(--accent-red)', tone: 'notReady' };
  }
  if (score >= 161 && score <= 180) {
    return {
      label: "YOU'RE STARTING TO SHAPE UP.",
      subtext: 'YOU ARE NOT READY.',
      color: 'var(--accent-red)',
      tone: 'notReady',
    };
  }

  if (score >= 181 && score <= 200) {
    return {
      label: "YOU'RE IN THE MIX NOW.",
      subtext: "YOU'RE NOT READY - BUT CLOSE.",
      color: 'var(--accent-orange)',
      tone: 'orange',
    };
  }
  if (score >= 201 && score <= 220) {
    return { label: "NOW WE'RE DANCING", subtext: "YOU'RE ALMOST READY.", color: 'var(--accent-yellow)', tone: 'yellow' };
  }
  if (score >= 221 && score <= 240) {
    return {
      label: "KEEP STACKING. DON'T GET COMFORTABLE.",
      subtext: "YOU'RE ALMOST READY.",
      color: 'var(--accent-yellow)',
      tone: 'yellow',
    };
  }
  if (score >= 241 && score <= 260) {
    return { label: 'ABS IS THAT YOU?', subtext: "YOU'RE CLOSE.", color: 'var(--accent-yellow)', tone: 'yellow' };
  }
  if (score >= 261 && score <= 280) {
    return {
      label: "YOU'RE GETTING DANGEROUS.",
      subtext: "YOU'RE ALMOST READY.",
      color: 'var(--accent-yellow)',
      tone: 'yellow',
    };
  }

  if (score >= 281 && score <= 300) {
    return {
      label: "YOU'RE CLOSE. VERY CLOSE.",
      subtext: "YOU'RE NEARLY READY.",
      color: 'var(--accent-green)',
      tone: 'ready',
    };
  }
  if (score >= 301 && score <= 320) {
    return {
      label: "YOU'RE READY. LET'S SEE IT THEN.",
      subtext: "YOU'RE READY.",
      color: 'var(--accent-green)',
      tone: 'ready',
    };
  }
  if (score >= 321 && score <= 340) {
    return {
      label: "YOU'RE READY. WALK LIKE IT.",
      subtext: "YOU'RE READY.",
      color: 'var(--accent-green)',
      tone: 'ready',
    };
  }

  if (score >= 341 && score <= 355) {
    return { label: 'FUCK WITH ME', subtext: "YOU'RE READY.", color: 'var(--accent-green)', tone: 'crush' };
  }
  if (score >= 356 && score <= 370) {
    return { label: 'JACKED AND STACKED', subtext: "YOU'RE READY.", color: 'var(--accent-green)', tone: 'crush' };
  }
  if (score >= 371 && score <= 385) {
    return { label: 'NINJA STATUS', subtext: "YOU'RE MORE THAN READY.", color: 'var(--accent-green)', tone: 'crush' };
  }
  if (score >= 386 && score <= 395) {
    return {
      label: "THEY DON'T WANT THE SMOKE",
      subtext: "YOU'RE MORE THAN READY.",
      color: 'var(--accent-green)',
      tone: 'crush',
    };
  }

  return { label: 'YOU ARE HYROX', subtext: 'ELITE.', color: 'var(--accent-green-bright)', tone: 'elite' };
}

/** Approximate session points for a single log row (display in workout list) */
export function getWorkoutSessionPoints(w, options = {}) {
  const { profile = null } = options;
  if (w.is_hyrox) {
    return Math.round(getHyroxSessionPoints(w));
  }
  if (w.is_lift) {
    const lift = LIFTS.find(l => l.id === w.lift_id);
    if (!lift) return 0;
    return w.heavy ? 30 : 15;
  }
  const activity = ACTIVITIES.find(a => a.id === w.activity_id);
  if (!activity) return 0;
  return Math.round(computeStationSessionPoints(w, activity, profile));
}

export function getDaysUntilRace(raceDate) {
  if (!raceDate) return null;
  const now = new Date();
  const race = new Date(raceDate);
  const diff = Math.ceil((race - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}
