import { useState } from 'react';
import styles from './NameSetup.module.css';

export default function NameSetup({ onSubmit }) {
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Welcome to HYROX Ready</h1>
        <p className={styles.subtitle}>What should we call you?</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          <button className={styles.btn} type="submit" disabled={!name.trim()}>
            Let's Go
          </button>
        </form>
      </div>
    </div>
  );
}
