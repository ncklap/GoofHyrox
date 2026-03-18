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
  };
}

export function getVerdict(score, hasWorkouts) {
  if (!hasWorkouts) {
    return { label: 'WHY ARE YOU HERE.', color: 'var(--muted)' };
  }
  if (score >= 390) return { label: 'YOU ARE HYROX.', color: 'var(--accent-green-bright)' };
  if (score >= 360) return { label: "YOU'LL CRUSH IT.", color: 'var(--accent-green)' };
  if (score >= 330) return { label: "YOU'RE READY.", color: 'var(--accent-green)' };
  if (score >= 280) return { label: 'GETTING DANGEROUS.', color: 'var(--accent-yellow)' };
  if (score >= 225) return { label: 'COULD BE WORSE.', color: 'var(--accent-orange)' };
  if (score >= 180) return { label: 'ROOM FOR GROWTH.', color: 'var(--accent-orange)' };
  if (score >= 135) return { label: 'NOT EVEN CLOSE.', color: 'var(--accent-red)' };
  if (score >= 90) return { label: 'BLESS YOUR HEART.', color: 'var(--accent-red)' };
  if (score >= 45) return { label: 'DEEPLY CONCERNING.', color: 'var(--accent-red)' };
  return { label: "YOU'RE FUCKED.", color: 'var(--accent-red)' };
}

export function getDaysUntilRace(raceDate) {
  if (!raceDate) return null;
  const now = new Date();
  const race = new Date(raceDate);
  const diff = Math.ceil((race - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}
