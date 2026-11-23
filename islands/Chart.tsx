import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Common = {
  title: string;
  series: string[];
  unit: string;
  better?: "lower" | "higher";
  setup?: string;
};

type BarProps = Common & {
  type?: "bar";
  rows: [string, ...number[]][];
};

type LineProps = Common & {
  type: "line";
  xUnit: string;
  scale?: "linear" | "log";
  rows: [number, ...number[]][];
};

type Props = BarProps | LineProps;

// The first series is the subject, the second the reference it is compared to.
const SWATCH = [
  "bg-[#2a78d6] dark:bg-[#3987e5]",
  "bg-gray-300 dark:bg-gray-500",
  "bg-[#1baf7a] dark:bg-[#199e70]",
];
const LINE_SWATCH = [
  "bg-[#2a78d6] dark:bg-[#3987e5]",
  "bg-gray-400 dark:bg-gray-500",
  "bg-[#1baf7a] dark:bg-[#199e70]",
];
const STROKE = [
  "stroke-[#2a78d6] dark:stroke-[#3987e5]",
  "stroke-gray-400 dark:stroke-gray-500",
  "stroke-[#1baf7a] dark:stroke-[#199e70]",
];
const FILL = [
  "fill-[#2a78d6] dark:fill-[#3987e5]",
  "fill-gray-400 dark:fill-gray-500",
  "fill-[#1baf7a] dark:fill-[#199e70]",
];

function color(classes: string[], i: number): string {
  return classes[i % classes.length] ?? "";
}

function number(v: number): string {
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return v.toLocaleString("en", { maximumFractionDigits: digits });
}

function format(v: number, unit: string): string {
  return unit === "×" || unit === "%" ? `${number(v)}${unit}` : `${number(v)} ${unit}`;
}

function values<T>([, ...rest]: [T, ...number[]]): number[] {
  return rest;
}

export default function Chart(props: Props) {
  const better = props.better ?? "lower";
  return (
    <figure className="not-prose my-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <figcaption className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-gray-200 px-4 pb-3 pt-4 sm:px-5 dark:border-gray-700">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{props.title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {better === "lower" ? "Lower is better" : "Higher is better"}
          </div>
        </div>
        {props.series.length > 1 && (
          <Legend series={props.series} swatches={props.type === "line" ? LINE_SWATCH : SWATCH} />
        )}
      </figcaption>
      {props.type === "line" ? (
        <div className="px-4 pt-3 sm:px-5">
          <Line {...props} />
        </div>
      ) : (
        <Bars {...props} better={better} />
      )}
      {props.setup && (
        <p className="px-4 pb-3 pt-1.5 text-xs text-gray-500 sm:px-5 dark:text-gray-400">{props.setup}</p>
      )}
    </figure>
  );
}

function Legend({ series, swatches }: { series: string[]; swatches: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-sm text-gray-600 dark:text-gray-300">
      {series.map((name, i) => (
        <span key={name} className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${color(swatches, i)}`} aria-hidden="true" />
          {name}
        </span>
      ))}
    </div>
  );
}

const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_3.5rem]";
const ROW_SINGLE = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[14rem_minmax(0,1fr)]";

function Row({ cols, label, bars, result }: { cols: string; label: ReactNode; bars: ReactNode; result: ReactNode }) {
  return (
    <div className={`${cols} px-4 py-2 sm:px-5`}>
      <div className="text-sm leading-snug text-gray-800 dark:text-gray-200">{label}</div>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">{bars}</div>
      <div className="col-start-2 row-start-1 text-right sm:col-start-3">{result}</div>
    </div>
  );
}

function Bars({ rows, series, unit, better }: BarProps & { better: "lower" | "higher" }) {
  const max = Math.max(...rows.flatMap(values), 0);
  const compared = series.length === 2;
  return (
    <div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {rows.map((row) => {
          const [label, ...vals] = row;
          const [subject, ref] = vals;
          const ratio =
            compared && subject !== undefined && ref !== undefined && subject > 0 && ref > 0
              ? better === "lower"
                ? ref / subject
                : subject / ref
              : undefined;
          return (
            <Row
              key={label}
              cols={compared ? ROW : ROW_SINGLE}
              label={label}
              bars={
                <div className="space-y-[3px]">
                  {vals.map((v, i) => (
                    <div key={series[i] ?? i} className="flex items-center gap-2" title={series[i]}>
                      <div
                        className={`h-2.5 rounded-r-[3px] ${color(SWATCH, i)}`}
                        style={{ width: `calc((100% - 4.5rem) * ${max > 0 ? v / max : 0})`, minWidth: "2px" }}
                      />
                      <span
                        className={`text-xs tabular-nums ${i === 0 ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        {format(v, unit)}
                      </span>
                    </div>
                  ))}
                </div>
              }
              result={
                ratio !== undefined && (
                  <span
                    className="font-semibold tabular-nums text-gray-900 dark:text-white"
                  >
                    {ratio.toFixed(2)}×
                  </span>
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function ticks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let t = 0; t <= max + step * 1e-9; t += step) out.push(t);
  if ((out.at(-1) ?? 0) < max) out.push(out.length * step);
  return out;
}

type Tick = { value: number; labelled: boolean };

// Lines at 1..9 times each power of ten, from the one below min to the one above max, labelling the powers.
function logTicks(min: number, max: number): Tick[] {
  const steps: Tick[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (let m = 1; m <= 9; m++) steps.push({ value: m * 10 ** e, labelled: m === 1 });
  }
  const lo = steps.filter((t) => t.value <= min).at(-1)?.value ?? min;
  const hi = steps.find((t) => t.value >= max)?.value ?? max;
  return steps.filter((t) => t.value >= lo && t.value <= hi);
}

// Approximate width of a 12px label, enough to reserve room beside the plot.
function textWidth(s: string): number {
  return s.length * 6.5;
}

const HEIGHT = 260;
const PAD = { top: 10, bottom: 28 };

function Line({ rows, series, unit, xUnit, scale = "linear" }: LineProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const xs = rows.map((r) => r[0]);
  const xMax = Math.max(...xs, 1);
  const xTicks = ticks(xMax, width < 480 ? 3 : 5).filter((t) => t <= xMax);
  const ys = rows.flatMap(values);
  const log = scale === "log";
  const yTicks: Tick[] = log
    ? logTicks(Math.min(...ys.filter((v) => v > 0)), Math.max(...ys))
    : ticks(Math.max(...ys), 4).map((value) => ({ value, labelled: true }));
  const yMin = log ? (yTicks[0]?.value ?? 1) : 0;
  const yMax = yTicks.at(-1)?.value ?? 1;
  const left = Math.max(...yTicks.filter((t) => t.labelled).map((t) => textWidth(format(t.value, unit)))) + 12;
  const named = width >= 480;
  const right = named ? Math.max(...series.map(textWidth)) + 16 : 12;
  const plotW = Math.max(width - left - right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (v: number) => left + (v / xMax) * plotW;
  const frac = (v: number) =>
    log ? (Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) : v / yMax;
  const y = (v: number) => PAD.top + plotH - frac(v) * plotH;


  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(x(v) - px) < Math.abs(x(xs[best] ?? 0) - px)) best = i;
    });
    setHover(best);
  };

  const active = hover === null ? undefined : rows[hover];
  const last = rows.at(-1);

  return (
    <div ref={box} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        className="block touch-pan-y select-none overflow-visible text-xs"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        aria-hidden="true"
      >
        {yTicks.map((t) => (
          <g key={t.value}>
            <line
              x1={left}
              x2={left + plotW}
              y1={y(t.value)}
              y2={y(t.value)}
              className={
                t.value === yMin
                  ? "stroke-gray-300 dark:stroke-gray-600"
                  : t.labelled
                    ? log
                      ? "stroke-gray-200 dark:stroke-gray-700"
                      : "stroke-gray-100 dark:stroke-gray-700"
                    : "stroke-gray-100 dark:stroke-gray-700/40"
              }
            />
            {t.labelled && (
              <text
                x={left - 8}
                y={y(t.value)}
                dy="0.32em"
                textAnchor="end"
                className="fill-gray-500 dark:fill-gray-400 tabular-nums"
              >
                {format(t.value, unit)}
              </text>
            )}
          </g>
        ))}
        {xTicks.map((t, i) => {
          const label = i === xTicks.length - 1 ? `${number(t)} ${xUnit}` : number(t);
          const anchor =
            x(t) - textWidth(label) / 2 < 0 ? "start" : x(t) + textWidth(label) / 2 > width ? "end" : "middle";
          return (
            <text
              key={t}
              x={x(t)}
              y={HEIGHT - 8}
              textAnchor={anchor}
              className="fill-gray-500 dark:fill-gray-400 tabular-nums"
            >
              {label}
            </text>
          );
        })}
        {active && (
          <line
            x1={x(active[0])}
            x2={x(active[0])}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="stroke-gray-300 dark:stroke-gray-600"
          />
        )}
        {series.map((name, s) => (
          <g key={name}>
            <polyline
              points={rows.map((r) => `${x(r[0])},${y(values(r)[s] ?? 0)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={color(STROKE, s)}
            />
            {rows.map((r, i) => (
              <circle
                key={r[0]}
                cx={x(r[0])}
                cy={y(values(r)[s] ?? 0)}
                r={i === hover ? 5 : 4}
                strokeWidth={2}
                className={`${color(FILL, s)} stroke-white dark:stroke-gray-800`}
              />
            ))}
            {named && last && (
              <text
                x={x(last[0]) + 10}
                y={y(values(last)[s] ?? 0)}
                dy="0.32em"
                className="fill-gray-700 dark:fill-gray-300"
              >
                {name}
              </text>
            )}
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{series.join(", ")}</caption>
        <thead>
          <tr>
            <th>{xUnit}</th>
            {series.map((name) => (
              <th key={name}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <td>{number(r[0])}</td>
              {values(r).map((v, i) => (
                <td key={series[i] ?? i}>{format(v, unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {active && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
          style={
            x(active[0]) > width / 2
              ? { right: width - x(active[0]) + 10 }
              : { left: x(active[0]) + 10 }
          }
        >
          <div className="mb-0.5 text-gray-500 dark:text-gray-400">
            {number(active[0])} {xUnit}
          </div>
          {series.map((name, s) => (
            <div key={name} className="flex items-center gap-2 whitespace-nowrap text-gray-900 dark:text-white">
              <span className={`h-2 w-2 rounded-sm ${color(LINE_SWATCH, s)}`} aria-hidden="true" />
              <span className="text-gray-500 dark:text-gray-400">{name}</span>
              <span className="ml-auto pl-3 tabular-nums">{format(values(active)[s] ?? 0, unit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
