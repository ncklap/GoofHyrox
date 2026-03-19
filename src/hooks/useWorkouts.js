import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const LIFT_TRACKING_CACHE_KEY = 'goofhyrox_lift_tracking_cache_v1';
const WORKOUT_TABLE_CANDIDATES = ['workouts', 'workout'];

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
    if (isLift) {
      // Supabase insert would fail if the workouts table doesn't have these columns.
      delete dbWorkout.lift_weight_kg;
      delete dbWorkout.lift_sets;
      delete dbWorkout.lift_reps;
    }

    const tables = workoutTable
      ? [workoutTable, ...WORKOUT_TABLE_CANDIDATES.filter(t => t !== workoutTable)]
      : WORKOUT_TABLE_CANDIDATES;

    let lastError = null;
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .insert({ user_id: userId, ...dbWorkout })
        .select()
        .single();

      if (!error && data) {
        setWorkoutTable(table);

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

  return { workouts, loading, addWorkout, deleteWorkout, refetch: fetchWorkouts };
}
