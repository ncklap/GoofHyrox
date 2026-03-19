import { ACTIVITIES, CATEGORIES, LIFTS } from './constants.js';

const RECENCY_DAYS = 15;

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

function computeSessionPoints(activity, value, hard) {
  const base = activity.id === 'run' ? getRunBase(value) : 50;
  const ratio = value / activity.target;
  const volumeScore = ratio >= 0.8 ? 1.0 : ratio;
  const intensityMultiplier = hard ? 0.5 : 1.0;
  return base * volumeScore * intensityMultiplier;
}

export function computeScores(workouts) {
  const recentWorkouts = workouts.filter(w => isRecent(w.logged_at));

  // Initialize category scores
  const catScores = {};
  for (const cat of Object.keys(CATEGORIES)) {
    catScores[cat] = 0;
  }

  // 1. Activity workouts — group by activity, take top N (cap), sum
  for (const activity of ACTIVITIES) {
    const sessions = recentWorkouts
      .filter(w => !w.is_lift && !w.is_hyrox && w.activity_id === activity.id)
      .map(w => computeSessionPoints(activity, w.value, w.hard))
      .sort((a, b) => b - a)
      .slice(0, activity.cap);

    catScores[activity.cat] += sessions.reduce((s, v) => s + v, 0);
  }

  // 2. Lift workouts — group by lift_id, take top 2 per lift, distribute points
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

  // 3. Hyrox workouts — apply completion % × intensity to each category
  const hyroxSessions = recentWorkouts.filter(w => w.is_hyrox);
  for (const session of hyroxSessions) {
    const completionPct =
      session.hyrox_length === 'full' ? 1.0 :
      session.hyrox_length === 'half' ? 0.5 : 0.25;
    const intensityMult = session.hyrox_intensity === 'hard' ? 0.75 : 1.0;

    for (const [cat, info] of Object.entries(CATEGORIES)) {
      catScores[cat] += info.max * completionPct * intensityMult;
    }
  }

  // 4. Cap each category at its max
  for (const [cat, info] of Object.entries(CATEGORIES)) {
    catScores[cat] = Math.min(catScores[cat], info.max);
  }

  // 5. Compute raw total
  let total = Object.values(catScores).reduce((s, v) => s + v, 0);

  // 6. Missing core penalty
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
  // If the user hasn't logged anything yet, keep the onboarding tone.
  if (!hasWorkouts && score === 0) {
    return {
      label: 'WHY ARE YOU HERE.',
      subtext: 'YOU ARE NOT READY.',
      color: 'var(--muted)',
      tone: 'onboarding',
    };
  }

  // Score is in [0..400]. Use the provided range buckets.
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
export function getWorkoutSessionPoints(w) {
  if (w.is_hyrox) {
    const completionPct =
      w.hyrox_length === 'full' ? 1.0 :
      w.hyrox_length === 'half' ? 0.5 : 0.25;
    const intensityMult = w.hyrox_intensity === 'hard' ? 0.75 : 1.0;
    let sum = 0;
    for (const [, info] of Object.entries(CATEGORIES)) {
      sum += info.max * completionPct * intensityMult;
    }
    return Math.round(sum);
  }
  if (w.is_lift) {
    const lift = LIFTS.find(l => l.id === w.lift_id);
    if (!lift) return 0;
    return w.heavy ? 30 : 15;
  }
  const activity = ACTIVITIES.find(a => a.id === w.activity_id);
  if (!activity) return 0;
  return Math.round(computeSessionPoints(activity, w.value, w.hard));
}

export function getDaysUntilRace(raceDate) {
  if (!raceDate) return null;
  const now = new Date();
  const race = new Date(raceDate);
  const diff = Math.ceil((race - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}
