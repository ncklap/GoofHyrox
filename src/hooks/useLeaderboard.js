import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { computeScores, getVerdict } from '../lib/scoring.js';

export function useLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);

    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .gte('logged_at', cutoff.toISOString());

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
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-workouts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workouts',
      }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  return { entries, loading, refetch: fetchLeaderboard };
}
