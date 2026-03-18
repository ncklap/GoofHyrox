import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  DEV_SKIP_AUTH,
  DEV_USER_ID,
  loadDevProfile,
  saveDevProfile,
} from '../lib/devMode.js';

const devSession = {
  user: {
    id: DEV_USER_ID,
    email: 'dev@localhost',
    user_metadata: {},
  },
};

export function useAuth() {
  const [session, setSession] = useState(DEV_SKIP_AUTH ? devSession : null);
  const [profile, setProfile] = useState(DEV_SKIP_AUTH ? loadDevProfile() : null);
  const [loading, setLoading] = useState(!DEV_SKIP_AUTH);

  useEffect(() => {
    if (DEV_SKIP_AUTH) {
      setSession(devSession);
      setProfile(loadDevProfile());
      setLoading(false);

      const onSync = () => setProfile(loadDevProfile());
      window.addEventListener('hyrox-dev-sync', onSync);
      return () => window.removeEventListener('hyrox-dev-sync', onSync);
    }

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

  const signInWithGoogle = useCallback(async () => {
    if (DEV_SKIP_AUTH) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  const signInWithEmailPassword = useCallback(async (email, password) => {
    if (DEV_SKIP_AUTH) return { error: null };

    // First try sign-in (existing user).
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      return { data: signInData, error: null };
    }

    // If the user doesn't exist yet, attempt sign-up, then sign-in again.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      // Some Supabase setups return an error even when the account already exists; fall back to sign-in.
      const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data: signInData2, error: signInError2 || signUpError };
    }

    const { data: signInData3, error: signInError3 } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data: signInData3, error: signInError3 };
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_SKIP_AUTH) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const upsertProfile = useCallback(async (profileData) => {
    if (DEV_SKIP_AUTH) {
      const next = {
        ...loadDevProfile(),
        ...profileData,
        id: DEV_USER_ID,
      };
      saveDevProfile(next);
      setProfile(next);
      return { data: next, error: null };
    }
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
    signInWithGoogle,
    signInWithEmailPassword,
    signOut,
    upsertProfile,
    refreshProfile: () =>
      DEV_SKIP_AUTH
        ? setProfile(loadDevProfile())
        : session && fetchProfile(session.user.id),
  };
}
