import { useEffect, useRef } from 'react';
import styles from './BottomSheet.module.css';

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  stepCount = 0,
  currentStep = 0,
  showBack = false,
  onBack,
  scrollContent = false,
}) {
  const backdropRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />
        {stepCount > 0 && (
          <div className={styles.stepDots}>
            {Array.from({ length: stepCount }, (_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === currentStep ? styles.dotActive : ''}`}
              />
            ))}
          </div>
        )}
        {showBack && onBack && (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            ← Back
          </button>
        )}
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={scrollContent ? styles.contentScroll : styles.content}>{children}</div>
      </div>
    </div>
  );
}
