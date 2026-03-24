function getExerciseQueryBuilder(supabase, userId, workout) {
  let q = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId);

  if (workout.is_lift) {
    q = q.eq('is_lift', true).eq('lift_id', workout.lift_id);
  } else if (workout.is_hyrox) {
    q = q.eq('is_hyrox', true).eq('hyrox_length', workout.hyrox_length);
  } else {
    q = q
      .eq('is_lift', false)
      .eq('is_hyrox', false)
      .eq('activity_id', workout.activity_id);
  }

  return q;
}

async function getLiftSetsByWorkoutId(supabase, workoutId) {
  if (!workoutId) return [];
  const candidates = ['lift_sets', 'lift_set'];
  for (const table of candidates) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('workout_id', workoutId)
      .order('set_number', { ascending: true });
    if (!error) return data || [];
    const msg = String(error?.message || '').toLowerCase();
    if (!msg.includes('not found') && !msg.includes('does not exist')) return [];
  }
  return [];
}

function getLiftVolumeLbs(w) {
  const weightKg = Number(w?.lift_weight_kg);
  const reps = Number(w?.lift_reps);
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  return (weightKg * 2.205) * reps;
}

export async function getPreviousWorkout(supabase, userId, workout) {
  if (!supabase || !userId || !workout) {
    return { previous: null, currentSets: [], previousSets: [] };
  }

  const { data: previous } = await getExerciseQueryBuilder(supabase, userId, workout)
    .lt('logged_at', workout.logged_at)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentSets = [];
  let previousSets = [];
  if (workout.is_lift) {
    [currentSets, previousSets] = await Promise.all([
      getLiftSetsByWorkoutId(supabase, workout.id),
      getLiftSetsByWorkoutId(supabase, previous?.id),
    ]);
  }

  return { previous: previous ?? null, currentSets, previousSets };
}

export async function getPRStatus(supabase, userId, workout, currentVolume) {
  if (!supabase || !userId || !workout || !Number.isFinite(Number(currentVolume))) return false;

  const { data } = await getExerciseQueryBuilder(supabase, userId, workout)
    .order('logged_at', { ascending: false });
  const rows = data || [];
  if (!rows.length) return true;

  const historicalMax = rows.reduce((max, row) => Math.max(max, getLiftVolumeLbs(row)), 0);
  return Number(currentVolume) >= historicalMax;
}

export async function getHistoricalMaxWeights(supabase, userId, workout) {
  if (!supabase || !userId || !workout) return [];
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 3);

  const { data } = await getExerciseQueryBuilder(supabase, userId, workout)
    .gte('logged_at', fromDate.toISOString())
    .order('logged_at', { ascending: true });
  const rows = data || [];

  if (workout.is_lift) {
    return rows.map((row) => ({
      date: row.logged_at,
      maxWeightLbs: Number.isFinite(Number(row.lift_weight_kg))
        ? Number(row.lift_weight_kg) * 2.205
        : null,
    }));
  }
  if (workout.is_hyrox) {
    return rows.map((row) => ({
      date: row.logged_at,
      durationSeconds: Number.isFinite(Number(row.duration_seconds))
        ? Number(row.duration_seconds)
        : null,
    }));
  }

  return rows.map((row) => ({
    date: row.logged_at,
    distanceOrReps: Number.isFinite(Number(row.station_reps))
      ? Number(row.station_reps)
      : Number.isFinite(Number(row.distance_km))
        ? Number(row.distance_km)
        : Number.isFinite(Number(row.distance_m))
          ? Number(row.distance_m)
          : Number.isFinite(Number(row.value))
            ? Number(row.value)
            : null,
    distanceM: Number.isFinite(Number(row.distance_m)) ? Number(row.distance_m) : null,
    distanceKm: Number.isFinite(Number(row.distance_km)) ? Number(row.distance_km) : null,
    reps: Number.isFinite(Number(row.station_reps)) ? Number(row.station_reps) : null,
    weightLbs: Number.isFinite(Number(row.station_weight_lbs)) ? Number(row.station_weight_lbs) : null,
    durationSeconds: Number.isFinite(Number(row.duration_seconds)) ? Number(row.duration_seconds) : null,
  }));
}

export function computeLiftSessionVolume(workout, sets = []) {
  if (sets.length > 0) {
    return sets.reduce((sum, setRow) => {
      const lbs = Number(setRow.weight_kg) * 2.205;
      const reps = Number(setRow.reps);
      if (!Number.isFinite(lbs) || !Number.isFinite(reps)) return sum;
      return sum + (lbs * reps);
    }, 0);
  }
  return getLiftVolumeLbs(workout);
}
