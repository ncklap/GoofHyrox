import { useEffect, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      ref={ref}
      onClick={(e) => { if (e.target === ref.current) onCancel(); }}
    >
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        {message && <p className={styles.sub}>{message}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
