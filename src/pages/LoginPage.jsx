import { useState } from 'react';
import styles from './LoginPage.module.css';

export default function LoginPage({ onEmailLogin, onEmailSignUp, onPasswordReset }) {
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

  async function handleResetPassword() {
    setError('');
    setStatus('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email first, then tap reset password.');
      return;
    }
    if (!onPasswordReset) {
      setError('Password reset is not available.');
      return;
    }
    const { error: err } = await onPasswordReset(trimmedEmail);
    if (err) {
      setError(err.message || 'Could not send reset email.');
      return;
    }
    setStatus('Password reset email sent. Check your inbox.');
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.logoLabel}>HYROX</p>
        <h1 className={styles.title}>READY?</h1>
        <p className={styles.subtitle}>Track your readiness. Crush your race.</p>

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
          {mode === 'signin' && (
            <div className={styles.resetRow}>
              <button
                type="button"
                className={styles.secondaryLink}
                onClick={handleResetPassword}
              >
                Reset password
              </button>
            </div>
          )}
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
