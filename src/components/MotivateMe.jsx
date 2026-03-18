import { useState } from 'react';
import { QUOTES } from '../lib/constants.js';
import styles from './MotivateMe.module.css';

export default function MotivateMe() {
  const [quote, setQuote] = useState(null);

  function getRandomQuote() {
    const idx = Math.floor(Math.random() * QUOTES.length);
    setQuote(QUOTES[idx]);
  }

  return (
    <div className={styles.container}>
      <button className={styles.btn} onClick={getRandomQuote}>
        Motivate Me
      </button>
      {quote && (
        <div className={styles.card}>
          <p className={styles.quote}>"{quote.q}"</p>
          <p className={styles.author}>— {quote.a}</p>
        </div>
      )}
    </div>
  );
}
