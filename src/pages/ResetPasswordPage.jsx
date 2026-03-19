import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ResetPasswordPage.module.css';

export default function ResetPasswordPage({ session, onUpdatePassword }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) setStatus('Secure reset link verified. Set your new password below.');
  }, [session]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('');

    if (!session) {
      setError('Reset session is not active. Open the latest reset link from your email.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!onUpdatePassword) {
      setError('Password update is not available right now.');
      return;
    }

    setSaving(true);
    const { error: err } = await onUpdatePassword(password);
    setSaving(false);

    if (err) {
      setError(err.message || 'Could not update password.');
      return;
    }

    setStatus('Password updated successfully. Redirecting...');
    window.setTimeout(() => navigate('/app', { replace: true }), 900);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.logoLabel}>HYROX</p>
        <h1 className={styles.title}>RESET PASSWORD</h1>
        <p className={styles.subtitle}>Set a new password for your account.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button className={styles.primaryBtn} type="submit" disabled={saving || !session}>
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>

        {status ? <p className={styles.status}>{status}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {!session ? (
          <p className={styles.hint}>
            This reset link may be expired. Request a fresh one from the{' '}
            <Link className={styles.link} to="/">
              login page
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
