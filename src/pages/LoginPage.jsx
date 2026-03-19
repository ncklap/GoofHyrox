import { useState } from 'react';
import styles from './LoginPage.module.css';

export default function LoginPage({ onGoogleLogin, onEmailLogin, onEmailSignUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [status, setStatus] = useState('');

  async function handleCredentials(e) {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setStatus('');

    try {
      if (mode === 'signin') {
        if (!onEmailLogin) {
          setError('Login is not available.');
          return;
        }
        const { error: err } = await onEmailLogin(email, password);
        if (err) setError(err.message || 'Login failed');
        return;
      }

      if (!onEmailSignUp) {
        setError('Sign up is not available.');
        return;
      }

      const { data, error: err } = await onEmailSignUp(email, password);
      if (err) {
        setError(err.message || 'Sign up failed');
        return;
      }

      // If confirmations are not required, Supabase typically returns an active session immediately.
      // If confirmations are required, `session` is usually null and the user must verify via email.
      if (data?.session) {
        setStatus('Account created. Signed in successfully ✓');
      } else {
        setStatus('Account created. If confirmation is enabled, check your email then sign in.');
      }
    } catch (err) {
      // Supabase can throw for network/auth misconfiguration; surface the message in UI.
      const msg = err?.message || String(err) || 'Authentication failed';
      setError(msg);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.logoLabel}>HYROX</p>
        <h1 className={styles.title}>READY?</h1>
        <p className={styles.subtitle}>Track your readiness. Crush your race.</p>

        <button type="button" className={styles.googleBtn} onClick={onGoogleLogin}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          Continue with Google
        </button>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <div className={styles.modeRow}>
          {mode === 'signin' ? (
            <button
              type="button"
              className={styles.secondaryLink}
              onClick={() => setMode('signup')}
            >
              Create an account
            </button>
          ) : (
            <button
              type="button"
              className={styles.secondaryLink}
              onClick={() => setMode('signin')}
            >
              Back to sign in
            </button>
          )}
        </div>

        <form className={styles.emailForm} onSubmit={handleCredentials}>
          <input
            className={styles.input}
            type="email"
            placeholder="Username (email)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className={styles.primaryBtn} type="submit">
            {mode === 'signin' ? 'Continue' : 'Sign up'}
          </button>
        </form>

        {status && <div className={styles.sentMsg}>{status}</div>}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
