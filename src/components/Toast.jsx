import { useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast({ message, visible, onHide }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div className={styles.toast}>
      <span>{message}</span>
    </div>
  );
}
