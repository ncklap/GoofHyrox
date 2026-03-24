const LBS_PER_KG = 2.205;

function getWindowStart(rangeWeeks) {
  if (!rangeWeeks || rangeWeeks <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - (rangeWeeks * 7));
  return d.toISOString();
}

function getExerciseKey(workout) {
  if (workout?.is_lift) return `lift:${workout.lift_id}`;
  if (workout?.is_hyrox) return `hyrox:${workout.hyrox_length || 'any'}`;
  return `station:${workout.activity_id}`;
}

function getExerciseName(workout) {
  if (workout?.is_lift) return workout.lift_id || 'Lift';
  if (workout?.is_hyrox) return `Hyrox ${workout.hyrox_length || ''}`.trim();
  return workout.activity_id || 'Workout';
}

function getExerciseIcon(workout) {
  if (workout?.is_lift) return '🏋️';
  if (workout?.is_hyrox) return '🏁';
  if (workout?.activity_id === 'run') return '🏃';
  if (workout?.activity_id === 'rowing') return '🚣';
  if (workout?.activity_id === 'skierg') return '⛷️';
  if (workout?.activity_id === 'wallball') return '🏐';
  return '•';
}

function toDateKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // monday start
  d.setDate(d.getDate() - diff);
  return d;
}

function getDurationSeconds(workout) {
  return Number.isFinite(Number(workout?.duration_seconds)) ? Number(workout.duration_seconds) : null;
}

function getDistanceMeters(workout) {
  if (Number.isFinite(Number(workout?.distance_km))) return Number(workout.distance_km) * 1000;
  if (Number.isFinite(Number(workout?.distance_m))) return Number(workout.distance_m);
  if (workout?.activity_id === 'run' && Number.isFinite(Number(workout?.value))) return Number(workout.value);
  if (Number.isFinite(Number(workout?.value)) && !workout?.is_lift && !workout?.is_hyrox) return Number(workout.value);
  return null;
}

function getReps(workout) {
  if (Number.isFinite(Number(workout?.station_reps))) return Number(workout.station_reps);
  if (workout?.activity_id === 'wallball' && Number.isFinite(Number(workout?.value))) return Number(workout.value);
  return null;
}

function getLiftWeightLbs(workout, liftSets) {
  const sets = liftSets || [];
  if (sets.length > 0) {
    return Math.max(...sets.map((s) => Number(s.weight_kg || 0) * LBS_PER_KG), 0);
  }
  if (Number.isFinite(Number(workout?.lift_weight_kg))) return Number(workout.lift_weight_kg) * LBS_PER_KG;
  return null;
}

function getMetricForImprovement(workout, liftSets) {
  if (workout?.is_lift) {
    const w = getLiftWeightLbs(workout, liftSets);
    const reps = Number.isFinite(Number(workout?.lift_reps)) ? Number(workout.lift_reps) : 1;
    return w && reps ? w * reps : w;
  }
  if (workout?.is_hyrox) return getDurationSeconds(workout);
  const reps = getReps(workout);
  if (reps) return reps;
  return getDistanceMeters(workout);
}

export async function getProgressData(supabase, userId, rangeWeeks) {
  const startIso = getWindowStart(rangeWeeks);
  let workoutQuery = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: true });
  if (startIso) workoutQuery = workoutQuery.gte('logged_at', startIso);
  const { data: workouts = [] } = await workoutQuery;

  const liftWorkoutIds = workouts.filter((w) => w.is_lift).map((w) => w.id);
  let liftSets = [];
  if (liftWorkoutIds.length > 0) {
    const { data } = await supabase
      .from('lift_sets')
      .select('*')
      .in('workout_id', liftWorkoutIds)
      .order('set_number', { ascending: true });
    liftSets = data || [];
  }
  const liftSetsByWorkout = liftSets.reduce((acc, row) => {
    if (!acc[row.workout_id]) acc[row.workout_id] = [];
    acc[row.workout_id].push(row);
    return acc;
  }, {});

  const byExercise = workouts.reduce((acc, workout) => {
    const key = getExerciseKey(workout);
    if (!acc[key]) {
      acc[key] = {
        key,
        exerciseId: workout.is_lift ? workout.lift_id : workout.is_hyrox ? 'hyrox' : workout.activity_id,
        name: getExerciseName(workout),
        icon: getExerciseIcon(workout),
        sessions: [],
      };
    }
    acc[key].sessions.push({
      ...workout,
      liftSets: liftSetsByWorkout[workout.id] || [],
      metricValue: getMetricForImprovement(workout, liftSetsByWorkout[workout.id] || []),
    });
    return acc;
  }, {});

  return {
    allWorkouts: workouts,
    byExercise,
    liftSetsByWorkout,
  };
}

export function calcPercentImprovement(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 2) return [];
  const sorted = [...sessions].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
  const first = Number(sorted[0].metricValue);
  if (!Number.isFinite(first) || first === 0) return [];
  return sorted
    .map((s) => {
      const val = Number(s.metricValue);
      if (!Number.isFinite(val)) return null;
      return {
        date: s.logged_at,
        pct: ((val - first) / first) * 100,
        raw: val,
      };
    })
    .filter(Boolean);
}

export function calcWeightSeries(sessions, exerciseId) {
  const sorted = [...(sessions || [])].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
  return sorted
    .map((s) => {
      let weightLbs = null;
      if (s.is_lift) {
        weightLbs = getLiftWeightLbs(s, s.liftSets || []);
      } else if (exerciseId === 'farmers') {
        const oneHand = Number(s.station_weight_lbs);
        weightLbs = Number.isFinite(oneHand) ? oneHand * 2 : null;
      } else {
        const raw = Number(s.station_weight_lbs);
        weightLbs = Number.isFinite(raw) ? raw : null;
      }
      if (!Number.isFinite(weightLbs)) return null;
      return { date: s.logged_at, weightLbs };
    })
    .filter(Boolean);
}

export function calcDistanceSeries(sessions, exerciseId) {
  const sorted = [...(sessions || [])].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
  return sorted
    .map((s) => {
      if (exerciseId === 'hyrox') {
        const durationSeconds = getDurationSeconds(s);
        if (!Number.isFinite(durationSeconds)) return null;
        return { date: s.logged_at, value: durationSeconds, unit: 'sec' };
      }
      if (exerciseId === 'wallball') {
        const reps = getReps(s);
        if (!Number.isFinite(reps)) return null;
        return { date: s.logged_at, value: reps, unit: 'reps' };
      }
      if (exerciseId === 'run') {
        const m = getDistanceMeters(s);
        if (!Number.isFinite(m)) return null;
        return { date: s.logged_at, value: m / 1000, unit: 'km' };
      }
      const m = getDistanceMeters(s);
      const reps = getReps(s);
      if (Number.isFinite(m)) return { date: s.logged_at, value: m, unit: 'm' };
      if (Number.isFinite(reps)) return { date: s.logged_at, value: reps, unit: 'reps' };
      return null;
    })
    .filter(Boolean);
}

export function calcPRs(allWorkouts) {
  const byExercise = {};
  for (const w of allWorkouts || []) {
    const key = getExerciseKey(w);
    if (!byExercise[key]) byExercise[key] = [];
    byExercise[key].push(w);
  }
  return Object.entries(byExercise)
    .filter(([, rows]) => rows.length >= 2)
    .map(([key, rows]) => {
      const sample = rows[0];
      let best = null;
      let unit = '';
      if (sample.is_lift) {
        const vals = rows.map((r) => Number(r.lift_weight_kg) * LBS_PER_KG).filter(Number.isFinite);
        best = vals.length ? Math.max(...vals) : null;
        unit = 'lbs';
      } else if (sample.is_hyrox) {
        const vals = rows.map((r) => Number(r.duration_seconds)).filter(Number.isFinite);
        best = vals.length ? Math.min(...vals) : null;
        unit = 'mm:ss';
      } else if (sample.activity_id === 'run') {
        const vals = rows.map((r) => getDistanceMeters(r)).filter(Number.isFinite).map((m) => m / 1000);
        best = vals.length ? Math.max(...vals) : null;
        unit = 'km';
      } else if (sample.activity_id === 'wallball') {
        const vals = rows.map((r) => getReps(r)).filter(Number.isFinite);
        best = vals.length ? Math.max(...vals) : null;
        unit = 'reps';
      } else {
        const vals = rows.map((r) => getDistanceMeters(r)).filter(Number.isFinite);
        best = vals.length ? Math.max(...vals) : null;
        unit = 'm';
      }
      return {
        key,
        exerciseId: sample.is_lift ? sample.lift_id : sample.is_hyrox ? 'hyrox' : sample.activity_id,
        name: getExerciseName(sample),
        icon: getExerciseIcon(sample),
        value: best,
        unit,
      };
    })
    .filter((x) => Number.isFinite(Number(x.value)));
}

export function calcStreak(allWorkouts) {
  const weeks = new Set((allWorkouts || []).map((w) => startOfWeek(w.logged_at).toISOString()));
  if (weeks.size === 0) return 0;
  let streak = 0;
  let cursor = startOfWeek(new Date());
  while (weeks.has(cursor.toISOString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function calcMostImproved(allWorkouts, rangeWeeks) {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - (rangeWeeks * 7));
  const prevStart = new Date(currentStart);
  prevStart.setDate(currentStart.getDate() - (rangeWeeks * 7));

  const byExercise = {};
  for (const w of allWorkouts || []) {
    const key = getExerciseKey(w);
    if (!byExercise[key]) byExercise[key] = [];
    byExercise[key].push(w);
  }

  let best = null;
  for (const [key, rows] of Object.entries(byExercise)) {
    if (rows.length < 2) continue;
    const current = rows
      .filter((w) => new Date(w.logged_at) >= currentStart)
      .map((w) => getMetricForImprovement(w))
      .filter(Number.isFinite);
    const prev = rows
      .filter((w) => new Date(w.logged_at) >= prevStart && new Date(w.logged_at) < currentStart)
      .map((w) => getMetricForImprovement(w))
      .filter(Number.isFinite);
    if (current.length === 0 || prev.length === 0) continue;
    const currAvg = current.reduce((a, b) => a + b, 0) / current.length;
    const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (prevAvg <= 0) continue;
    const pct = ((currAvg - prevAvg) / prevAvg) * 100;
    const sample = rows[0];
    if (!best || pct > best.pct) {
      best = {
        key,
        exerciseId: sample.is_lift ? sample.lift_id : sample.is_hyrox ? 'hyrox' : sample.activity_id,
        name: getExerciseName(sample),
        icon: getExerciseIcon(sample),
        pct,
        rangeWeeks,
      };
    }
  }
  return best;
}

export function groupSessionsByDay(sessions) {
  const byDay = {};
  for (const s of sessions || []) {
    const key = toDateKey(s.logged_at);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(s);
  }
  return byDay;
}
