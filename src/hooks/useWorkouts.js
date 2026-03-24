import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const LIFT_TRACKING_CACHE_KEY = 'goofhyrox_lift_tracking_cache_v1';
const WORKOUT_TABLE_CANDIDATES = ['workouts', 'workout'];
const LIFT_SET_TABLE_CANDIDATES = ['lift_sets', 'lift_set'];

function isTableNotFoundError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.status);
  return (
    msg.includes('could not find the public') ||
    msg.includes('could not find the requested resource') ||
    msg.includes('does not exist') ||
    status === 404 ||
    msg.includes('404') ||
    msg.includes('not found') ||
    (code.startsWith('pgrst') && (msg.includes('not found') || msg.includes('does not exist')))
  );
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

function loadLiftTrackingCache() {
  try {
    const raw = localStorage.getItem(LIFT_TRACKING_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLiftTrackingCache(entries) {
  try {
    localStorage.setItem(LIFT_TRACKING_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function upsertLiftTrackingEntry(entry) {
  const entries = loadLiftTrackingCache();
  const next = entries.filter(e => e?.id !== entry?.id);
  next.unshift(entry);
  saveLiftTrackingCache(next.slice(0, 200));
}

function removeLiftTrackingEntry(workoutId) {
  const entries = loadLiftTrackingCache();
  const next = entries.filter(e => e?.id !== workoutId);
  saveLiftTrackingCache(next);
}

function mergeLiftTrackingIntoWorkouts(workouts) {
  const cache = loadLiftTrackingCache();
  const byId = new Map(cache.map(e => [e.id, e]));
  return (workouts || []).map(w => {
    const hit = byId.get(w.id);
    if (!hit) return w;
    return {
      ...w,
      lift_weight_kg: hit.lift_weight_kg ?? null,
      lift_sets: hit.lift_sets ?? null,
      lift_reps: hit.lift_reps ?? null,
    };
  });
}

export function useWorkouts(userId) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workoutTable, setWorkoutTable] = useState('workouts');

  const fetchWorkouts = useCallback(async () => {
    if (!userId) {
      setWorkouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const tables = workoutTable
      ? [workoutTable, ...WORKOUT_TABLE_CANDIDATES.filter(t => t !== workoutTable)]
      : WORKOUT_TABLE_CANDIDATES;

    let lastError = null;
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });

      if (!error) {
        setWorkoutTable(table);
        setWorkouts(mergeLiftTrackingIntoWorkouts(data || []));
        setLoading(false);
        return;
      }

      lastError = error;
      if (!isTableNotFoundError(error)) break;
    }

    // If we couldn't fetch (schema mismatch), keep the UI functional.
    console.error('Failed to fetch workouts:', lastError);
    setWorkouts([]);
    setLoading(false);
  }, [userId, workoutTable]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`workouts-changes-${workoutTable}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: workoutTable,
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchWorkouts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchWorkouts, workoutTable]);

  const addWorkout = useCallback(async (workout) => {
    const isLift = !!workout?.is_lift;
    const liftTracking = isLift
      ? {
        lift_weight_kg: workout.lift_weight_kg ?? null,
        lift_sets: workout.lift_sets ?? null,
        lift_reps: workout.lift_reps ?? null,
      }
      : null;
    const dbWorkout = { ...workout };
    const liftSetRows = Array.isArray(workout?.lift_set_rows) ? workout.lift_set_rows : [];
    if (isLift) {
      // Supabase insert would fail if the workouts table doesn't have these columns.
      delete dbWorkout.lift_weight_kg;
      delete dbWorkout.lift_sets;
      delete dbWorkout.lift_reps;
      delete dbWorkout.lift_set_rows;
    }

    const tables = workoutTable
      ? [workoutTable, ...WORKOUT_TABLE_CANDIDATES.filter(t => t !== workoutTable)]
      : WORKOUT_TABLE_CANDIDATES;

    let lastError = null;
    for (const table of tables) {
      const insertPayload = { user_id: userId, ...dbWorkout };
      let { data, error } = await supabase
        .from(table)
        .insert(insertPayload)
        .select()
        .single();

      if (error && isMissingColumnError(error)) {
        // Backward-compatible fallback when optional detail columns
        // have not been added in Supabase yet.
        delete insertPayload.distance_km;
        delete insertPayload.distance_m;
        delete insertPayload.duration_seconds;
        delete insertPayload.pace_per_unit;
        delete insertPayload.station_weight_lbs;
        delete insertPayload.station_weight_kg;
        delete insertPayload.station_reps;
        delete insertPayload.run_time_sec;
        delete insertPayload.run_pace_sec;
        delete insertPayload.run_pace_unit;
        const retry = await supabase
          .from(table)
          .insert(insertPayload)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        setWorkoutTable(table);

        if (isLift && liftSetRows.length > 0) {
          const setPayload = liftSetRows.map((setRow) => ({
            workout_id: data.id,
            user_id: userId,
            set_number: setRow.set_number,
            weight_kg: setRow.weight_kg,
            reps: setRow.reps,
          }));

          let setInsertError = null;
          for (const setTable of LIFT_SET_TABLE_CANDIDATES) {
            const { error: liftSetError } = await supabase
              .from(setTable)
              .insert(setPayload);
            if (!liftSetError) {
              setInsertError = null;
              break;
            }
            setInsertError = liftSetError;
            if (!isTableNotFoundError(liftSetError)) break;
          }

          if (setInsertError) {
            // If lift_sets table is missing in Supabase, keep workout logging functional
            // and persist only summary fields on workouts.
            if (isTableNotFoundError(setInsertError)) {
              console.warn('lift_sets table missing; saved workout without per-set rows.');
            } else {
            await supabase
              .from(table)
              .delete()
              .eq('id', data.id)
              .eq('user_id', userId);
              return { data: null, error: setInsertError };
            }
          }
        }

        const enriched = isLift && liftTracking
          ? {
            ...data,
            ...liftTracking,
          }
          : data;
        setWorkouts(prev => [enriched, ...prev]);

        if (isLift && liftTracking) {
          const hasAny =
            liftTracking.lift_weight_kg !== null ||
            liftTracking.lift_sets !== null ||
            liftTracking.lift_reps !== null;
          if (hasAny) {
            upsertLiftTrackingEntry({
              id: data.id,
              user_id: data.user_id,
              logged_at: data.logged_at,
              is_lift: true,
              lift_id: data.lift_id,
              ...liftTracking,
            });
          }
        }

        return { data, error: null };
      }

      lastError = error;
      if (!isTableNotFoundError(error)) break;
    }

    return { data: null, error: lastError };
  }, [userId, workoutTable]);

  const deleteWorkout = useCallback(async (workoutId) => {
    const tables = workoutTable
      ? [workoutTable, ...WORKOUT_TABLE_CANDIDATES.filter(t => t !== workoutTable)]
      : WORKOUT_TABLE_CANDIDATES;

    let lastError = null;
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', workoutId)
        .eq('user_id', userId);

      if (!error) {
        setWorkoutTable(table);
        setWorkouts(prev => prev.filter(w => w.id !== workoutId));
        removeLiftTrackingEntry(workoutId);
        return { error: null };
      }

      lastError = error;
      if (!isTableNotFoundError(error)) break;
    }

    return { error: lastError };
  }, [userId, workoutTable]);

  const updateWorkout = useCallback(async (workoutId, patch) => {
    if (!userId || !workoutId) {
      return { data: null, error: new Error('Missing user or workout') };
    }

    const allowedKeys = new Set([
      'activity_id',
      'value',
      'hard',
      'distance_km',
      'distance_m',
      'duration_seconds',
      'pace_per_unit',
      'station_weight_lbs',
      'station_weight_kg',
      'station_reps',
      'is_lift',
      'lift_id',
      'heavy',
      'lift_weight_kg',
      'lift_sets',
      'lift_reps',
      'is_hyrox',
      'hyrox_length',
      'hyrox_intensity',
      'logged_at',
    ]);

    const payload = {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (!allowedKeys.has(k)) continue;
      if (v === undefined) continue;
      payload[k] = v;
    }

    if (Object.keys(payload).length === 0) {
      return { data: null, error: new Error('Nothing to update') };
    }

    const tables = workoutTable
      ? [workoutTable, ...WORKOUT_TABLE_CANDIDATES.filter(t => t !== workoutTable)]
      : WORKOUT_TABLE_CANDIDATES;

    let lastError = null;
    for (const table of tables) {
      let attemptPayload = { ...payload };
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .update(attemptPayload)
          .eq('id', workoutId)
          .eq('user_id', userId)
          .select()
          .single();

        if (!error && data) {
          setWorkoutTable(table);
          const isLift = !!data.is_lift;
          const liftSummary = isLift
            ? {
              lift_weight_kg: attemptPayload.lift_weight_kg ?? data.lift_weight_kg ?? null,
              lift_sets: attemptPayload.lift_sets ?? data.lift_sets ?? null,
              lift_reps: attemptPayload.lift_reps ?? data.lift_reps ?? null,
              heavy: attemptPayload.heavy !== undefined ? attemptPayload.heavy : data.heavy,
            }
            : null;

          const merged = isLift && liftSummary
            ? { ...data, ...liftSummary }
            : data;

          setWorkouts((prev) => prev.map((w) => (w.id === workoutId ? merged : w)));

          if (isLift && liftSummary) {
            const hasAny =
              liftSummary.lift_weight_kg != null ||
              liftSummary.lift_sets != null ||
              liftSummary.lift_reps != null;
            if (hasAny) {
              upsertLiftTrackingEntry({
                id: data.id,
                user_id: data.user_id,
                logged_at: data.logged_at,
                is_lift: true,
                lift_id: data.lift_id,
                lift_weight_kg: liftSummary.lift_weight_kg,
                lift_sets: liftSummary.lift_sets,
                lift_reps: liftSummary.lift_reps,
              });
            }
          }

          return { data: merged, error: null };
        }

        if (error && isMissingColumnError(error)) {
          const optionalCols = [
            'distance_km',
            'distance_m',
            'duration_seconds',
            'pace_per_unit',
            'station_weight_lbs',
            'station_weight_kg',
            'station_reps',
            'lift_weight_kg',
            'lift_sets',
            'lift_reps',
          ];
          let stripped = false;
          for (const col of optionalCols) {
            if (col in attemptPayload) {
              delete attemptPayload[col];
              stripped = true;
            }
          }
          if (stripped) continue;
        }

        lastError = error;
        break;
      }
      if (lastError && !isTableNotFoundError(lastError)) break;
    }

    return { data: null, error: lastError };
  }, [userId, workoutTable]);

  return { workouts, loading, addWorkout, deleteWorkout, updateWorkout, refetch: fetchWorkouts };
}
