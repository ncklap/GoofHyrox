import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

export function useWorkouts(userId) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkouts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false });
    setWorkouts(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('workouts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workouts',
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchWorkouts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchWorkouts]);

  const addWorkout = useCallback(async (workout) => {
    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, ...workout })
      .select()
      .single();
    if (!error && data) {
      setWorkouts(prev => [data, ...prev]);
    }
    return { data, error };
  }, [userId]);

  const deleteWorkout = useCallback(async (workoutId) => {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId);
    if (!error) {
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));
    }
    return { error };
  }, [userId]);

  return { workouts, loading, addWorkout, deleteWorkout, refetch: fetchWorkouts };
}
