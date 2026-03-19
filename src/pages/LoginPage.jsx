import { useEffect, useState } from 'react';
import styles from './LoginPage.module.css';

export default function LoginPage({ onEmailLogin, onEmailSignUp, onPasswordReset }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [status, setStatus] = useState('');
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(Date.now());

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
    if (Date.now() < resetCooldownUntil) return;
    const cooldownMs = 5000;
    setResetCooldownUntil(Date.now() + cooldownMs);
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
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('rate limit')) {
        setStatus('Reset link already sent recently. Check your inbox (and spam) or wait a minute before trying again.');
        return;
      }
      setError(err.message || 'Could not send reset email.');
      return;
    }
    setStatus('Password reset email sent. Check your inbox.');
  }

  const cooldownRemaining = Math.max(
    0,
    Math.ceil((resetCooldownUntil - cooldownNow) / 1000)
  );
  const isResetCoolingDown = cooldownRemaining > 0;

  useEffect(() => {
    if (!isResetCoolingDown) return undefined;
    const timer = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [isResetCoolingDown]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.authCard}>
          <div className={styles.header}>
            <p className={styles.logoLabel}>HYROX</p>
            <h1 className={styles.title}>READY?</h1>
            <p className={styles.subtitle}>Track your readiness. Crush your race.</p>
          </div>

          <form className={styles.emailForm} onSubmit={handleCredentials}>
            <input
              className={styles.input}
              type="email"
              placeholder="Email address"
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
                  disabled={isResetCoolingDown}
                >
                  {isResetCoolingDown ? `Reset password (${cooldownRemaining}s)` : 'Reset password'}
                </button>
              </div>
            )}
            <button className={styles.primaryBtn} type="submit">
              {mode === 'signin' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <div className={styles.modeRow}>
            {mode === 'signin' ? (
              <button
                type="button"
                className={styles.secondaryLink}
                onClick={() => setMode('signup')}
              >
                New here? Create an account
              </button>
            ) : (
              <button
                type="button"
                className={styles.secondaryLink}
                onClick={() => setMode('signin')}
              >
                Already have an account? Back to sign in
              </button>
            )}
          </div>

          {(status || error) && (
            <div className={styles.feedbackWrap}>
              {status && <div className={styles.sentMsg}>{status}</div>}
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
