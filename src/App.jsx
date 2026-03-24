import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import LoginPage from './pages/LoginPage.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import MainApp from './pages/MainApp.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ProgressPage from './pages/ProgressPage.jsx';
import NameSetup from './pages/NameSetup.jsx';

function ProtectedRoute({ children, session, loading }) {
  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        color: 'var(--muted2)',
      }}>
        Loading...
      </div>
    );
  }
  if (!session) return <Navigate to="/" replace />;
  return children;
}

function pickExistingName(user) {
  const meta = user?.user_metadata ?? {};
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.preferred_name,
  ];
  return candidates.find((v) => typeof v === 'string' && v.trim().length > 1)?.trim() ?? '';
}

export default function App() {
  const {
    session,
    user,
    profile,
    loading,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    sendPasswordReset,
    updatePassword,
    signOut,
    upsertProfile,
  } = useAuth();

  const [provisioningProfile, setProvisioningProfile] = useState(false);
  const [provisionedForUserId, setProvisionedForUserId] = useState('');
  const existingName = useMemo(() => pickExistingName(user), [user]);
  const profileHasName = Boolean(profile?.name?.trim());
  const needsSetup = session && !loading && !profile && !existingName && !provisioningProfile;

  useEffect(() => {
    if (!session || loading || profile) return;
    if (!existingName) return;
    if (provisionedForUserId === session.user.id) return;

    let cancelled = false;
    setProvisioningProfile(true);
    (async () => {
      await upsertProfile({
        name: existingName,
        email: user?.email || '',
      });
      if (!cancelled) {
        setProvisionedForUserId(session.user.id);
        setProvisioningProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, loading, profile, existingName, provisionedForUserId, upsertProfile, user?.email]);

  async function handleNameSubmit(name) {
    return upsertProfile({
      name,
      email: user?.email || '',
    });
  }

  if (needsSetup) {
    return (
      <BrowserRouter>
        <NameSetup onSubmit={handleNameSubmit} />
      </BrowserRouter>
    );
  }

  if (session && !loading && !profile && (existingName || provisioningProfile) && !profileHasName) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        color: 'var(--muted2)',
      }}>
        Setting up your profile...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            session && !loading ? (
              <Navigate to="/app" replace />
            ) : (
              <LoginPage
                onEmailLogin={signInWithEmailPassword}
                onEmailSignUp={signUpWithEmailPassword}
                onPasswordReset={sendPasswordReset}
              />
            )
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/reset-password"
          element={<ResetPasswordPage session={session} onUpdatePassword={updatePassword} />}
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <MainApp profile={profile} onSignOut={signOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <Leaderboard currentUserId={user?.id} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <ProgressPage profile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <ProfilePage
                profile={profile}
                onUpdate={upsertProfile}
                onSignOut={signOut}
              />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
