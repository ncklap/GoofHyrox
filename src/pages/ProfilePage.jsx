import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './ProfilePage.module.css';

export default function ProfilePage({ profile, onUpdate, onSignOut }) {
  const [name, setName] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setRaceDate(profile.race_date || '');
    }
  }, [profile]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await onUpdate({
      name,
      race_date: raceDate || null,
      email: profile?.email,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <Link to="/app" className={styles.backLink}>Back</Link>
      </header>

      <form className={styles.form} onSubmit={handleSave}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            value={profile?.email || ''}
            disabled
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Race Date</label>
          <input
            className={styles.input}
            type="date"
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
          />
        </div>

        <button className={styles.saveBtn} type="submit" disabled={saving}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </form>

      <button className={styles.signOutBtn} onClick={onSignOut}>
        Sign Out
      </button>

      <nav className={styles.nav}>
        <Link to="/app" className={styles.navLink}>Home</Link>
        <Link to="/leaderboard" className={styles.navLink}>Leaderboard</Link>
        <Link to="/profile" className={`${styles.navLink} ${styles.active}`}>Profile</Link>
      </nav>
    </div>
  );
}
