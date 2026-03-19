import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
// This app uses real Supabase auth in all environments.

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.warn('profiles fetch:', error.message);
    setProfile(data ?? null);
    setLoading(false);
  }

  const signInWithEmailPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    return { data, error };
  }, []);

  const signUpWithEmailPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Used when email confirmations are enabled.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const upsertProfile = useCallback(async (profileData) => {
    if (!session) return { data: null, error: new Error('Not signed in') };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { id: session.user.id, ...profileData },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (!error) setProfile(data);
    return { data, error };
  }, [session]);

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    sendPasswordReset,
    signOut,
    upsertProfile,
    refreshProfile: () => session && fetchProfile(session.user.id),
  };
}
