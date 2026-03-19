import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { computeScores, getVerdict } from '../lib/scoring.js';

export function useLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workoutTable, setWorkoutTable] = useState('workouts');

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

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);

    const tableCandidates = workoutTable
      ? [workoutTable, 'workouts', 'workout'].filter((v, i, arr) => arr.indexOf(v) === i)
      : ['workouts', 'workout'];

    let workouts = null;
    let lastError = null;
    for (const table of tableCandidates) {
      const { data: tableRows, error } = await supabase
        .from(table)
        .select('*')
        .gte('logged_at', cutoff.toISOString());

      if (!error) {
        workouts = tableRows;
        setWorkoutTable(table);
        break;
      }

      lastError = error;
      if (!isTableNotFoundError(error)) break;
    }

    if (!profiles) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const board = profiles.map(profile => {
      const userWorkouts = (workouts || []).filter(w => w.user_id === profile.id);
      const scores = computeScores(userWorkouts);
      const verdict = getVerdict(scores.total, userWorkouts.length > 0);
      return {
        profile,
        scores,
        verdict,
        workoutCount: userWorkouts.length,
      };
    });

    board.sort((a, b) => b.scores.total - a.scores.total);
    setEntries(board);
    setLoading(false);
    if (lastError) {
      // Helpful when schema names don't match.
      console.error('Failed to fetch leaderboard workouts:', lastError);
    }
  }, [workoutTable]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel(`leaderboard-workouts-${workoutTable}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: workoutTable,
      }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard, workoutTable]);

  return { entries, loading, refetch: fetchLeaderboard };
}
