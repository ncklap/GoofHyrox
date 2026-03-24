import { useEffect, useRef, useState } from 'react';
import { QUOTES } from '../lib/constants.js';
import styles from './MotivateMe.module.css';

export default function MotivateMe() {
  const [quote, setQuote] = useState(null);
  const cardRef = useRef(null);

  function getRandomQuote() {
    const idx = Math.floor(Math.random() * QUOTES.length);
    setQuote(QUOTES[idx]);
  }

  useEffect(() => {
    if (!quote || !cardRef.current) return;
    const card = cardRef.current;
    requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const bottomPadding = 96;
      const overflowBottom = rect.bottom + bottomPadding - window.innerHeight;
      if (overflowBottom > 0) {
        window.scrollBy({ top: overflowBottom, behavior: 'smooth' });
      } else {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, [quote]);

  return (
    <div className={styles.container}>
      <button className={styles.btn} onClick={getRandomQuote}>
        Motivate Me
      </button>
      {quote && (
        <div ref={cardRef} className={styles.card}>
          <p className={styles.quote}>"{quote.q}"</p>
          <p className={styles.author}>— {quote.a}</p>
        </div>
      )}
    </div>
  );
}
