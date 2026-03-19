import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import LoginPage from './pages/LoginPage.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import MainApp from './pages/MainApp.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
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

  const needsSetup = session && !loading && !profile;

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
