import { useState } from 'react';
import styles from './NameSetup.module.css';

export default function NameSetup({ onSubmit }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setError('');
    setSaving(true);
    const { error: err } = await onSubmit(trimmed);
    setSaving(false);
    if (err) {
      setError(err.message || 'Could not save your profile. Check Supabase RLS and the profiles table.');
    }
  }

  const canSubmit = name.trim().length >= 2;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.logoLabel}>HYROX</p>
        <h1 className={styles.title}>READY?</h1>
        <p className={styles.subtitle}>What should we call you?</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button
            className={styles.btn}
            type="submit"
            disabled={!canSubmit || saving}
          >
            {saving ? 'Saving…' : "Let's go"}
          </button>
        </form>
      </div>
    </div>
  );
}
