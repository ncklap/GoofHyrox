/** raceTarget = race-day distance/reps; target = full-score training target */
export const ACTIVITIES = [
  { id: 'run',      cat: 'run',      unit: 'm',    target: 6000, raceTarget: 8000, cap: 4 },
  { id: 'skierg',   cat: 'skirow',   unit: 'm',    target: 750,  raceTarget: 1000, cap: 2 },
  { id: 'rowing',   cat: 'skirow',   unit: 'm',    target: 750,  raceTarget: 1000, cap: 2 },
  { id: 'sledpush', cat: 'sled',     unit: 'm',    target: 38,   raceTarget: 50,   cap: 2 },
  { id: 'sledpull', cat: 'sled',     unit: 'm',    target: 38,   raceTarget: 50,   cap: 2 },
  { id: 'burpee',   cat: 'fullbody', unit: 'm',    target: 60,   raceTarget: 80,   cap: 2 },
  { id: 'farmers',  cat: 'carry',    unit: 'm',    target: 150,  raceTarget: 200,  cap: 2 },
  { id: 'sandbag',  cat: 'carry',    unit: 'm',    target: 75,   raceTarget: 100,  cap: 2 },
  { id: 'wallball', cat: 'fullbody', unit: 'reps', target: 75,   raceTarget: 100,  cap: 2 },
];

export const CATEGORIES = {
  run:      { max: 100, core: true },
  skirow:   { max: 75,  core: true },
  sled:     { max: 75,  core: true },
  carry:    { max: 75,  core: true },
  fullbody: { max: 75,  core: false },
};

/** Category keys in Hyrox preview order */
export const CATEGORY_ORDER = ['run', 'skirow', 'sled', 'carry', 'fullbody'];

/** Activities in a category (for station-pick step) */
export function getActivitiesForCategory(cat) {
  return ACTIVITIES.filter((a) => a.cat === cat);
}

export const CATEGORY_PREVIEW = {
  run:      { icon: '🏃', label: 'Run' },
  skirow:   { icon: '⛷️', label: 'Ski & Row' },
  sled:     { icon: '🛷', label: 'Sled' },
  carry:    { icon: '🎒', label: 'Carry' },
  fullbody: { icon: '💪', label: 'Full Body' },
};

export const LIFTS = [
  { id: 'squat',      split: { sled: 0.50, carry: 0.30, fullbody: 0.20 } },
  { id: 'deadlift',   split: { sled: 0.40, carry: 0.40, fullbody: 0.20 } },
  { id: 'bench',      split: { skirow: 0.60, fullbody: 0.40 } },
  { id: 'barbellrow', split: { skirow: 0.50, sled: 0.30, carry: 0.20 } },
  { id: 'ohp',        split: { skirow: 0.40, fullbody: 0.60 } },
];

/** One-line “feeds into” per lift */
export const LIFT_FEEDS = {
  squat:      '🛷 Sled · 🎒 Carry · 💪 Full Body',
  deadlift:   '🛷 Sled · 🎒 Carry · 💪 Full Body',
  bench:      '⛷️ Ski & Row · 💪 Full Body',
  barbellrow: '⛷️ Ski & Row · 🛷 Sled · 🎒 Carry',
  ohp:        '⛷️ Ski & Row · 💪 Full Body',
};

export const VERDICTS = [
  { min: 0,   max: 0,   label: 'WHY ARE YOU HERE.',     color: 'var(--muted)' },
  { min: 1,   max: 44,  label: "YOU'RE FUCKED.",        color: 'var(--accent-red)' },
  { min: 45,  max: 89,  label: 'DEEPLY CONCERNING.',    color: 'var(--accent-red)' },
  { min: 90,  max: 134, label: 'BLESS YOUR HEART.',     color: 'var(--accent-red)' },
  { min: 135, max: 179, label: 'NOT EVEN CLOSE.',       color: 'var(--accent-red)' },
  { min: 180, max: 224, label: 'ROOM FOR GROWTH.',      color: 'var(--accent-orange)' },
  { min: 225, max: 279, label: 'COULD BE WORSE.',       color: 'var(--accent-orange)' },
  { min: 280, max: 329, label: 'GETTING DANGEROUS.',    color: 'var(--accent-yellow)' },
  { min: 330, max: 359, label: "YOU'RE READY.",         color: 'var(--accent-green)' },
  { min: 360, max: 389, label: "YOU'LL CRUSH IT.",      color: 'var(--accent-green)' },
  { min: 390, max: 400, label: 'YOU ARE HYROX.',        color: 'var(--accent-green-bright)' },
];

export const QUOTES = [
  { q: "The secret of getting ahead is getting started.", a: "Mark Twain" },
  { q: "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'", a: "Muhammad Ali" },
  { q: "We are what we repeatedly do. Excellence then is not an act but a habit.", a: "Aristotle" },
  { q: "If you want something you've never had, you must be willing to do something you've never done.", a: "Thomas Jefferson" },
  { q: "The hard days are the best because that's when champions are made.", a: "Dana Vollmer" },
  { q: "Nobody who ever gave his best regretted it.", a: "George Halas" },
  { q: "Strength does not come from physical capacity. It comes from an indomitable will.", a: "Mahatma Gandhi" },
  { q: "Everybody wants to be a bodybuilder, but don't nobody want to lift no heavy-ass weights.", a: "Ronnie Coleman" },
  { q: "The body achieves what the mind believes.", a: "Napoleon Hill" },
  { q: "Take care of your body. It's the only place you have to live.", a: "Jim Rohn" },
  { q: "I've failed over and over again in my life. And that is why I succeed.", a: "Michael Jordan" },
  { q: "Exercise should be regarded as tribute to the heart.", a: "Gene Tunney" },
  { q: "Most people fail, not because of lack of desire, but because of lack of commitment.", a: "Vince Lombardi" },
  { q: "If something stands between you and your success, move it. Never be denied.", a: "Dwayne 'The Rock' Johnson" },
  { q: "Just believe in yourself… eventually you will.", a: "Venus Williams" },
  { q: "Strength does not come from winning. Your struggles develop your strengths.", a: "Arnold Schwarzenegger" },
  { q: "Don't limit your challenges. Challenge your limits.", a: "Jerry Dunn" },
  { q: "You must expect things of yourself before you can do them.", a: "Michael Jordan" },
  { q: "The last three or four reps is what makes the muscle grow.", a: "Arnold Schwarzenegger" },
  { q: "If you fail to prepare, you're prepared to fail.", a: "Mark Spitz" },
  { q: "The only bad workout is the one that didn't happen.", a: "Unknown" },
  { q: "When I feel tired, I think about how great I will feel once I reach my goal.", a: "Michael Phelps" },
  { q: "Paradise… may not be a destination but an endless horizon.", a: "Chris Bumstead" },
  { q: "You can either suffer the pain of discipline or the pain of regret.", a: "Jim Rohn" },
  { q: "If you are not pissed off for greatness, you're okay with being mediocre.", a: "Ray Lewis" },
  { q: "Keep working even when no one is watching.", a: "Alex Morgan" },
  { q: "Discipline is doing what you hate to do, but doing it like you love it.", a: "Mike Tyson" },
];

export const ACTIVITY_ICONS = {
  run: '🏃',
  skierg: '⛷️',
  rowing: '🚣',
  sledpush: '🛷',
  sledpull: '⬆️',
  burpee: '💪',
  farmers: '🎒',
  sandbag: '🏋️',
  wallball: '🏐',
};

export const ACTIVITY_LABELS = {
  run: 'Run',
  skierg: 'SkiErg',
  rowing: 'Rowing',
  sledpush: 'Sled Push',
  sledpull: 'Sled Pull',
  burpee: 'Burpee Broad Jumps',
  farmers: 'Farmers Carry',
  sandbag: 'Sandbag Lunges',
  wallball: 'Wall Balls',
};

export const LIFT_ICONS = {
  squat: '🏋️',
  deadlift: '⚡',
  bench: '🛏️',
  barbellrow: '📏',
  ohp: '⬆️',
};

export const LIFT_LABELS = {
  squat: 'Squat',
  deadlift: 'Deadlift',
  bench: 'Bench Press',
  barbellrow: 'Barbell Row',
  ohp: 'Overhead Press',
};

export const CATEGORY_LABELS = {
  run: 'Running',
  skirow: 'Ski & Row',
  sled: 'Sled',
  carry: 'Carry',
  fullbody: 'Full Body',
};

export const CATEGORY_ICONS = {
  run: '🏃',
  skirow: '🎿',
  sled: '🛷',
  carry: '🏋️',
  fullbody: '💪',
};

export const CATEGORY_TAGS = {
  run: 'Cardio',
  skirow: 'Erg work',
  sled: 'Power',
  carry: 'Grip & core',
  fullbody: 'Hybrid',
};

export function formatActivityTargetHint(activity) {
  if (activity.unit === 'reps') {
    return `Race = ${activity.raceTarget} reps · Target = ${activity.target} reps`;
  }
  const r = activity.raceTarget;
  const t = activity.target;
  const fmt = (m) => (m >= 1000 ? `${m / 1000}km` : `${m}m`);
  return `Race = ${fmt(r)} · Target = ${fmt(t)}`;
}
