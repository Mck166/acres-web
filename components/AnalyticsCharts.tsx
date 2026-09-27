import {
  changeVsPrevious,
  formatDayLabel,
  pointsVsPrevious,
} from "@/lib/adminAnalytics";
import styles from "@/components/AnalyticsDashboard.module.css";

// The building blocks shared by every section of the admin analytics page.

const number = new Intl.NumberFormat("en-CA");

export type Metric = {
  key: string;
  label: string;
  /** null when the metric cannot be measured yet, shown as a dash. */
  value: number | null;
  previous: number | null;
  note: string;
  /** Longer explanation, surfaced as the card's tooltip. */
  hint?: string;
  /** Percentages compare in points, since a relative change of a rate reads
   * as nonsense ("40% to 45%" is not "+13%"). */
  changeMode?: "points";
  /** For metrics where going up is bad, like cancellations. */
  invert?: boolean;
  /** What the change chip is measured against, read out in its tooltip. */
  comparison: string;
  /** For metrics whose headline number cannot be compared, the chip falls back
   * to a related one that can. */
  compare?: {
    value: number;
    previous: number;
    note: string;
    format?: (value: number) => string;
  };
  format?: (value: number) => string;
  series?: number[];
  featured?: boolean;
  wide?: boolean;
};

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const peak = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map(
    (value, index) => `${(index * step).toFixed(2)},${(30 - (value / peak) * 26).toFixed(2)}`,
  );

  return (
    <svg
      className={styles.spark}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M0,32 ${points.map((point) => `L${point}`).join(" ")} L100,32 Z`}
        fill="currentColor"
        fillOpacity="0.14"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type Series = {
  label: string;
  values: number[];
};

export function Chart({
  days,
  series,
  comparison,
  format: customFormat,
}: {
  days: { day: string }[];
  series: Series[];
  comparison?: Series;
  format?: (value: number) => string;
}) {
  const format = customFormat ?? ((value: number) => number.format(value));
  const peak = Math.max(
    1,
    ...series.flatMap((item) => item.values),
    ...(comparison?.values ?? []),
  );
  const total = series.reduce(
    (sum, item) => sum + item.values.reduce((inner, value) => inner + value, 0),
    0,
  );
  const average = days.length ? total / days.length : 0;
  const labelEvery = Math.max(1, Math.ceil(days.length / 4));
  // Past a few months the gaps between bars would eat the bars themselves.
  const dense = days.length > 120;

  return (
    <div className={styles.chart}>
      <div className={styles.chartHead}>
        <div className={styles.legend}>
          {series.map((item, index) => (
            <span key={item.label} className={styles.legendItem}>
              <span className={`${styles.swatch} ${index === 1 ? styles.swatchAlt : ""}`} />
              {item.label}
            </span>
          ))}
          {comparison ? (
            <span className={styles.legendItem}>
              <span className={styles.swatchGhost} />
              {comparison.label}
            </span>
          ) : null}
        </div>
        <p className={styles.chartMeta}>
          Peak {format(peak)} · Avg{" "}
          {customFormat ? customFormat(average) : average.toFixed(average < 10 ? 1 : 0)} per day
        </p>
      </div>

      <div className={styles.plot}>
        <div className={styles.grid} aria-hidden="true">
          {[1, 0.5, 0].map((fraction) => (
            <div key={fraction} className={styles.gridLine}>
              <span>{format(Math.round(peak * fraction))}</span>
            </div>
          ))}
        </div>

        <div className={`${styles.bars} ${dense ? styles.dense : ""}`}>
          {days.map((day, dayIndex) => (
            <div key={day.day} className={styles.slot}>
              <div className={styles.tip}>
                <strong>{formatDayLabel(day.day)}</strong>
                {series.map((item) => (
                  <span key={item.label}>
                    {item.label}
                    <b>{format(item.values[dayIndex])}</b>
                  </span>
                ))}
                {comparison ? (
                  <span className={styles.tipGhost}>
                    {comparison.label}
                    <b>{format(comparison.values[dayIndex] ?? 0)}</b>
                  </span>
                ) : null}
              </div>
              <div className={styles.stack}>
                {series.map((item, index) => (
                  <div
                    key={item.label}
                    className={`${styles.bar} ${index === 1 ? styles.barAlt : ""}`}
                    style={{ height: `${(item.values[dayIndex] / peak) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {comparison ? (
          <svg
            className={styles.overlay}
            viewBox={`0 0 ${days.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={days
                .map(
                  (_, index) =>
                    `${index + 0.5},${100 - ((comparison.values[index] ?? 0) / peak) * 100}`,
                )
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
      </div>

      <div className={`${styles.xAxis} ${dense ? styles.dense : ""}`} aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.day} className={styles.xTick}>
            {index % labelEvery === 0 ? formatDayLabel(day.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Ranked({
  rows,
  total,
  empty,
}: {
  rows: { name: string; value: number }[];
  total: number;
  empty: string;
}) {
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  const top = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ol className={styles.ranks}>
      {rows.map((row, index) => (
        <li key={row.name} className={styles.rank}>
          <span className={styles.rankIndex}>{index + 1}</span>
          <span className={styles.rankName}>{row.name}</span>
          <span className={styles.rankTrack}>
            <span className={styles.rankFill} style={{ width: `${(row.value / top) * 100}%` }} />
          </span>
          <span className={styles.rankValue}>{number.format(row.value)}</span>
          <span className={styles.rankShare}>
            {Math.round((row.value / (total || 1)) * 100)}%
          </span>
        </li>
      ))}
    </ol>
  );
}

const FLIPPED = { up: "down", down: "up", flat: "flat" } as const;

export function MetricCards({ metrics }: { metrics: Metric[] }) {
  return (
    <section className={styles.cards}>
      {metrics.map((metric, index) => {
        const compare = metric.compare;
        const current = compare ? compare.value : metric.value;
        const before = compare ? compare.previous : metric.previous;
        const format = metric.format ?? ((value: number) => number.format(value));
        const formatDelta = compare?.format ?? format;
        const change =
          current === null
            ? null
            : metric.changeMode === "points"
              ? pointsVsPrevious(current, before)
              : changeVsPrevious(current, before);
        const tone = change ? (metric.invert ? FLIPPED[change.direction] : change.direction) : null;
        // A rounded "was" that reads the same as the headline looks
        // like a rendering bug, so only show one that differs.
        const prior =
          before === null ||
          (!compare && metric.value !== null && format(before) === format(metric.value))
            ? null
            : compare && current !== null
              ? ` · ${formatDelta(current)} vs ${formatDelta(before)} ${compare.note}`
              : ` · was ${format(before)}`;

        return (
          <article
            key={metric.key}
            className={`${styles.card} ${metric.featured ? styles.cardFeatured : ""} ${
              metric.wide ? styles.cardWide : ""
            }`}
            style={{ animationDelay: `${index * 45}ms` }}
            title={metric.hint}
          >
            <div className={styles.cardTop}>
              <span className={styles.cardLabel}>{metric.label}</span>
              {change && tone ? (
                <span
                  className={`${styles.trend} ${styles[`trend${tone}`]}`}
                  title={`${current === null ? "—" : formatDelta(current)} vs ${
                    before === null ? "—" : formatDelta(before)
                  }${compare ? ` ${compare.note}` : ""} in the ${metric.comparison}`}
                >
                  {change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "■"}{" "}
                  {change.label}
                </span>
              ) : null}
            </div>
            <strong className={styles.cardValue}>
              {metric.value === null ? "—" : format(metric.value)}
            </strong>
            <span className={styles.cardNote}>
              {metric.note}
              {prior ? <span className={styles.cardPrior}>{prior}</span> : null}
            </span>
            {metric.series ? (
              <div className={styles.cardSpark}>
                <Sparkline values={metric.series} />
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
