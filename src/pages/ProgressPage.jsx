import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EXERCISE_CONFIG } from '../config/exerciseConfig.js';
import { supabase } from '../lib/supabase.js';
import {
  calcDistanceSeries,
  calcMostImproved,
  calcPRs,
  calcPercentImprovement,
  calcStreak,
  calcWeightSeries,
  getProgressData,
} from '../lib/progressData.js';
import styles from './ProgressPage.module.css';

const RANGE_OPTIONS = [
  { id: '4w', label: '4w', weeks: 4 },
  { id: '3m', label: '3m', weeks: 12 },
  { id: 'all', label: 'All', weeks: 0 },
];

const TAB_OPTIONS = [
  { id: 'pct', label: '% Improvement' },
  { id: 'weight', label: 'Weight' },
  { id: 'timeDistance', label: 'Time & Distance' },
];

const EX_COLORS = {
  run: '#d4f233',
  skierg: '#75d7ff',
  rowing: '#3fc6ff',
  sledpush: '#ff9f43',
  sledpull: '#ff6f6f',
  burpee: '#ffd166',
  farmers: '#4ecdc4',
  sandbag: '#a78bfa',
  wallball: '#f472b6',
  hyrox: '#9ca3af',
  squat: '#fbbf24',
  deadlift: '#f97316',
  bench: '#60a5fa',
  barbellrow: '#34d399',
  ohp: '#fb7185',
};

function shortDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#2a2a2c',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 0.5,
        titleColor: '#9b9b9b',
        bodyColor: '#fff',
      },
    },
    elements: {
      line: { borderWidth: 1.5, tension: 0.4 },
      point: { radius: 0, hoverRadius: 4 },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 5, maxRotation: 0, minRotation: 0 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#555', font: { size: 10 } },
      },
    },
  };
}

function createDataset(label, key, points) {
  const color = EX_COLORS[key] || '#d4f233';
  return {
    label,
    data: points,
    parsing: false,
    borderColor: color,
    backgroundColor: color,
  };
}

function prDisplay(pr) {
  if (pr.unit === 'mm:ss') {
    const total = Number(pr.value);
    const m = Math.floor(total / 60);
    const s = Math.round(total % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (pr.unit === 'km') return `${Number(pr.value).toFixed(1)}km`;
  if (pr.unit === 'm') return `${Math.round(Number(pr.value))}m`;
  if (pr.unit === 'lbs') return `${Math.round(Number(pr.value))}lbs`;
  if (pr.unit === 'reps') return `${Math.round(Number(pr.value))} reps`;
  return `${Math.round(Number(pr.value))}`;
}

export default function ProgressPage({ profile }) {
  const [tab, setTab] = useState('pct');
  const [range, setRange] = useState('4w');
  const [data, setData] = useState({ allWorkouts: [], byExercise: {} });
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  const rangeWeeks = RANGE_OPTIONS.find((r) => r.id === range)?.weeks ?? 4;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await getProgressData(supabase, profile.id, rangeWeeks);
      if (cancelled) return;
      setData(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id, rangeWeeks]);

  const allWorkouts = data.allWorkouts || [];
  const byExerciseEntries = Object.values(data.byExercise || {});
  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return allWorkouts.filter((w) => {
      const d = new Date(w.logged_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [allWorkouts]);

  const streak = useMemo(() => calcStreak(allWorkouts), [allWorkouts]);
  const prs = useMemo(() => calcPRs(allWorkouts), [allWorkouts]);
  const mostImproved = useMemo(() => calcMostImproved(allWorkouts, rangeWeeks || 4), [allWorkouts, rangeWeeks]);

  const chartModel = useMemo(() => {
    if (tab === 'pct') {
      const series = byExerciseEntries
        .map((exercise) => {
          const pctSeries = calcPercentImprovement(exercise.sessions);
          if (pctSeries.length < 2) return null;
          return {
            key: exercise.exerciseId,
            label: exercise.name,
            points: pctSeries.map((p) => ({
              x: shortDate(p.date),
              y: Number(p.pct.toFixed(1)),
              raw: p.raw,
            })),
          };
        })
        .filter(Boolean);
      return { series, yTitle: '%', hyroxLowerBetter: false };
    }

    if (tab === 'weight') {
      const allowed = new Set(['sledpush', 'sledpull', 'farmers'].filter((id) => EXERCISE_CONFIG[id]?.weight));
      const series = byExerciseEntries
        .filter((exercise) => exercise.sessions.some((s) => s.is_lift) || allowed.has(exercise.exerciseId))
        .map((exercise) => {
          const wSeries = calcWeightSeries(exercise.sessions, exercise.exerciseId);
          if (wSeries.length < 1) return null;
          return {
            key: exercise.exerciseId,
            label: exercise.name,
            points: wSeries.map((p) => ({ x: shortDate(p.date), y: Number(p.weightLbs.toFixed(1)) })),
          };
        })
        .filter(Boolean);
      return { series, yTitle: 'lbs', hyroxLowerBetter: false };
    }

    const allowed = [...Object.keys(EXERCISE_CONFIG), 'hyrox'];
    const rawSeries = byExerciseEntries
      .filter((exercise) => allowed.includes(exercise.exerciseId))
      .map((exercise) => {
        const dSeries = calcDistanceSeries(exercise.sessions, exercise.exerciseId);
        if (dSeries.length < 1) return null;
        return {
          key: exercise.exerciseId,
          label: exercise.name,
          values: dSeries,
        };
      })
      .filter(Boolean);

    const series = rawSeries.map((s) => {
      const vals = s.values.map((v) => Number(v.value)).filter(Number.isFinite);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const rangeVal = max - min || 1;
      const invert = s.key === 'hyrox';
      return {
        key: s.key,
        label: s.label,
        points: s.values.map((v) => ({
          x: shortDate(v.date),
          y: invert ? (100 - (((Number(v.value) - min) / rangeVal) * 100)) : (((Number(v.value) - min) / rangeVal) * 100),
          raw: Number(v.value),
          unit: v.unit,
        })),
      };
    });

    return { series, yTitle: '0-100', hyroxLowerBetter: true };
  }, [tab, byExerciseEntries]);

  useEffect(() => {
    if (loading) return;
    if (range === 'all') return;
    if ((chartModel.series || []).length > 0) return;
    setRange('all');
  }, [loading, range, chartModel.series]);

  useEffect(() => {
    const Chart = window.Chart;
    if (!Chart || !canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const datasets = chartModel.series.map((s) => createDataset(s.label, s.key, s.points));
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { datasets },
      options: {
        ...buildChartOptions(),
        plugins: {
          ...buildChartOptions().plugins,
          tooltip: {
            ...buildChartOptions().plugins.tooltip,
            callbacks: {
              label(ctx) {
                const ds = chartModel.series[ctx.datasetIndex];
                const p = ds?.points?.[ctx.dataIndex];
                if (!p) return `${ctx.formattedValue}`;
                if (tab === 'pct') {
                  return `${ds.label} · ${p.y}% · ${Math.round(Number(p.raw || 0))}`;
                }
                if (tab === 'weight') {
                  return `${ds.label} · ${p.y} lbs`;
                }
                if (p.unit === 'sec') {
                  const m = Math.floor(Number(p.raw || 0) / 60);
                  const s = Math.round(Number(p.raw || 0) % 60);
                  return `${ds.label} · ${m}:${String(s).padStart(2, '0')}`;
                }
                return `${ds.label} · ${Math.round(Number(p.raw || 0))}${p.unit || ''}`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartModel, tab]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.appName}>HYROX READY</span>
        <Link to="/app" className={styles.backLink}>← Back</Link>
      </header>

      <h2 className="hyrox-section-label">Progress</h2>

      <section className={styles.summaryGrid}>
        <article className={styles.card}>
          <p className={styles.cardLabel}>Training streak</p>
          <p className={styles.cardValue}>{streak}<span className={styles.suffix}>wks</span></p>
          <p className={styles.cardSub}>{streak > 0 ? 'Keep it going' : 'Start your streak!'}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.cardLabel}>This month</p>
          <p className={styles.cardValue}>{thisMonthCount}</p>
          <p className={styles.cardSub}>sessions logged</p>
        </article>
        <article className={`${styles.card} ${styles.span2}`}>
          <p className={styles.cardLabel}>Most improved</p>
          {mostImproved ? (
            <>
              <p className={styles.cardValue}>{mostImproved.icon} {mostImproved.name}</p>
              <p className={styles.cardSub}>+{mostImproved.pct.toFixed(1)}% over {mostImproved.rangeWeeks} weeks</p>
            </>
          ) : (
            <p className={styles.cardSub}>Need more sessions to calculate</p>
          )}
        </article>
      </section>

      <section className={styles.prRow}>
        {prs.map((pr) => (
          <span key={pr.key} className={styles.prPill}>
            {pr.icon} {pr.name}: {prDisplay(pr)}
          </span>
        ))}
      </section>

      <section className={styles.chartTabs}>
        <div className={styles.tabRow}>
          {TAB_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.rangeRow}>
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.rangeBtn} ${range === r.id ? styles.rangeActive : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className={styles.chartCard}>
          {loading ? (
            <p className={styles.loading}>Loading progress...</p>
          ) : chartModel.series.length === 0 ? (
            <p className={styles.loading}>Not enough data yet.</p>
          ) : (
            <>
              <div className={styles.canvasWrap}>
                <canvas ref={canvasRef} />
              </div>
              <div className={styles.legendRow}>
                {chartModel.series.map((s) => (
                  <span key={s.key} className={styles.legendItem}>
                    <span className={styles.dot} style={{ background: EX_COLORS[s.key] || '#d4f233' }} />
                    {s.label}
                  </span>
                ))}
              </div>
              {tab === 'timeDistance' && chartModel.hyroxLowerBetter && (
                <p className={styles.muted}>lower is better</p>
              )}
            </>
          )}
        </div>
      </section>

      <nav className={styles.nav}>
        <Link to="/app" className={styles.navLink}>Home</Link>
        <Link to="/progress" className={`${styles.navLink} ${styles.active}`}>Progress</Link>
        <Link to="/leaderboard" className={styles.navLink}>Board</Link>
        <Link to="/profile" className={styles.navLink}>Profile</Link>
      </nav>
    </div>
  );
}
