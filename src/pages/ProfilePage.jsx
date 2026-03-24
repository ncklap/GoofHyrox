import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import styles from './ProfilePage.module.css';

function getInitials(name) {
  if (!name?.trim()) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProfilePage({ profile, onUpdate, onSignOut }) {
  const [name, setName] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [gender, setGender] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [hyroxRaceType, setHyroxRaceType] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);

  function kgToLbs(kg) {
    return kg / 0.45359237;
  }

  function lbsToKg(lbs) {
    return lbs * 0.45359237;
  }

  function cmToFtIn(cm) {
    const totalIn = cm / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inchRemainder = totalIn - ft * 12;
    // Round to nearest whole inch for simpler input.
    const inch = Math.round(inchRemainder);
    // Handle edge case where rounding pushes inches to 12.
    const safeIn = inch === 12 ? 0 : inch;
    const safeFt = inch === 12 ? ft + 1 : ft;
    return { ft: safeFt, in: safeIn };
  }

  function ftInToCm(ft, inch) {
    const totalIn = ft * 12 + inch;
    return totalIn * 2.54;
  }

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setRaceDate(profile.race_date || '');
      setGender(profile.gender || '');
      if (profile.height_cm !== null && profile.height_cm !== undefined && profile.height_cm !== '') {
        const parsed = Number(profile.height_cm);
        if (Number.isFinite(parsed) && parsed > 0) {
          const { ft, in: inches } = cmToFtIn(parsed);
          setHeightFt(String(ft));
          setHeightIn(String(inches));
        } else {
          setHeightFt('');
          setHeightIn('');
        }
      } else {
        setHeightFt('');
        setHeightIn('');
      }
      if (profile.weight_kg !== null && profile.weight_kg !== undefined && profile.weight_kg !== '') {
        const parsed = Number(profile.weight_kg);
        if (Number.isFinite(parsed) && parsed > 0) {
          setWeightLbs(String(Math.round(kgToLbs(parsed) * 10) / 10));
        } else {
          setWeightLbs('');
        }
      } else {
        setWeightLbs('');
      }
      setWeightUnit(profile.weight_unit === 'lbs' ? 'lbs' : 'kg');
      setDistanceUnit(profile.distance_unit === 'miles' ? 'miles' : 'km');
      setHyroxRaceType(profile.hyrox_race_type || '');
    }
  }, [profile]);

  async function handleSave(e) {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    setSaved(false);
    const res = await onUpdate({
      name,
      race_date: raceDate || null,
      email: profile?.email,
      gender: gender || null,
      height_cm: (() => {
        const ft = heightFt.trim() === '' ? null : Number(heightFt);
        const inch = heightIn.trim() === '' ? null : Number(heightIn);
        if (ft === null && inch === null) return null;
        if (!Number.isFinite(ft) || !Number.isFinite(inch)) return null;
        return ftInToCm(ft, inch);
      })(),
      weight_kg: weightLbs.trim() === '' ? null : lbsToKg(Number(weightLbs)),
      weight_unit: weightUnit,
      distance_unit: distanceUnit,
      hyrox_race_type: hyroxRaceType || null,
    });

    setSaving(false);
    if (res?.error) {
      setErrorMsg(res.error.message || 'Could not save profile.');
      setSaved(false);
      return;
    }

    setSaved(true);
    setErrorMsg('');
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/app" className={styles.backLink}>← Back</Link>
      </header>

      <div className={styles.hero}>
        <div className={styles.avatar}>{getInitials(name || profile?.name)}</div>
        <h1 className={styles.displayName}>{name || profile?.name || 'Athlete'}</h1>
        <p className={styles.email}>{profile?.email || ''}</p>
      </div>

      <form className={styles.form} onSubmit={handleSave}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Name</span>
          <input
            className={styles.statInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Race date</span>
          <input
            className={styles.statInput}
            type="date"
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
          />
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>(Male / Female)</span>
          <select
            className={styles.statInput}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">(Male / Female)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Height (ft / in)</span>
          <div className={styles.heightInputs}>
            <input
              className={styles.statInput}
              type="number"
              inputMode="numeric"
              step="1"
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value)}
              placeholder="ft"
            />
            <input
              className={styles.statInput}
              type="number"
              inputMode="numeric"
              step="1"
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
              placeholder="in"
            />
          </div>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Weight (lbs)</span>
          <input
            className={styles.statInput}
            type="number"
            inputMode="decimal"
            step="0.5"
            value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)}
            placeholder="e.g., 170"
          />
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Weight unit</span>
          <select
            className={styles.statInput}
            value={weightUnit}
            onChange={(e) => setWeightUnit(e.target.value)}
          >
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
          </select>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Distance unit</span>
          <select
            className={styles.statInput}
            value={distanceUnit}
            onChange={(e) => setDistanceUnit(e.target.value)}
          >
            <option value="km">km</option>
            <option value="miles">miles</option>
          </select>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Hyrox race type</span>
          <select
            className={styles.statInput}
            value={hyroxRaceType}
            onChange={(e) => setHyroxRaceType(e.target.value)}
          >
            <option value="">(single / double / pro)</option>
            <option value="single">single</option>
            <option value="double">double</option>
            <option value="pro">pro</option>
          </select>
        </div>

        <button className={styles.saveBtn} type="submit" disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
        {errorMsg ? (
          <p className={styles.error} role="alert">
            {errorMsg}
          </p>
        ) : null}
      </form>

      <nav className={styles.nav}>
        <Link to="/app" className={styles.navLink}>Home</Link>
        <Link to="/progress" className={styles.navLink}>Progress</Link>
        <Link to="/leaderboard" className={styles.navLink}>Board</Link>
        <Link to="/profile" className={`${styles.navLink} ${styles.active}`}>Profile</Link>
      </nav>

      <button type="button" className={styles.signOutBtn} onClick={() => setConfirmOut(true)}>
        Log out
      </button>

      <ConfirmDialog
        open={confirmOut}
        title="Log out?"
        message="You'll need to sign in again to access your training data."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          onSignOut();
        }}
      />
    </div>
  );
}
