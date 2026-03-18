/** Set VITE_DEV_SKIP_AUTH=true in .env to skip login; data stays in localStorage. */
export const DEV_SKIP_AUTH = import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

export const DEV_USER_ID = '11111111-1111-1111-1111-111111111111';

const PROFILE_KEY = 'goofhyrox_dev_profile';
const WORKOUTS_KEY = 'goofhyrox_dev_workouts';

export function loadDevProfile() {
  const fallback = {
    id: DEV_USER_ID,
    name: 'Dev',
    email: 'dev@localhost',
    race_date: null,
  };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...fallback, ...JSON.parse(raw), id: DEV_USER_ID };
  } catch { /* ignore */ }
  return fallback;
}

export function saveDevProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('hyrox-dev-sync'));
}

export function loadDevWorkouts() {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveDevWorkouts(workouts) {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('hyrox-dev-sync'));
}
