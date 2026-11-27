type Result = "good" | "bad";

type Props = {
  good: string;
  bad: string;
  steps: [string, Result][];
  culprit?: string;
  badLabel?: string;
};

const DAY = 86_400_000;

const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fmt = (d: string) =>
  new Date(parse(d)).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const FILL: Record<Result, string> = {
  good: "bg-[#1baf7a] dark:bg-[#199e70]",
  bad: "bg-[#eb6834] dark:bg-[#d95926]",
};
const INK: Record<Result, string> = {
  good: "text-[#13865d] dark:text-[#2fc48d]",
  bad: "text-[#d0491a] dark:text-[#f07a4a]",
};

export default function BisectRange({ good, bad, steps, culprit, badLabel = "bad" }: Props) {
  const start = parse(good);
  const span = parse(bad) - start;
  const x = (d: string) => ((parse(d) - start) / span) * 100;

  let lo = good;
  let hi = bad;
  const rows = steps.map(([date, result]) => {
    const row = { lo, hi, date, result };
    if (result === "good") lo = date;
    else hi = date;
    return row;
  });
  const days = Math.round((parse(hi) - parse(lo)) / DAY);

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <div className="px-4 py-3 text-xs sm:px-5">
          <div className="grid grid-cols-[1rem_minmax(0,1fr)_7rem] gap-2 pb-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem] sm:gap-3 text-gray-500 dark:text-gray-400">
            <span />
            <div className="flex justify-between gap-2">
              <span>
                {fmt(good)} <span className={INK.good}>good</span>
              </span>
              <span className="text-right">
                {fmt(bad)} <span className={INK.bad}>{badLabel}</span>
              </span>
            </div>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1rem_minmax(0,1fr)_7rem] sm:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem] items-center gap-2 py-1 sm:gap-3">
              <span className="tabular-nums text-gray-400 dark:text-gray-500">{i + 1}</span>
              <div className="relative h-3">
                <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-700" />
                <div
                  className="absolute top-0 h-3 min-w-[2px] rounded-sm bg-gray-200 dark:bg-gray-600"
                  style={{ left: `${x(r.lo)}%`, width: `${x(r.hi) - x(r.lo)}%` }}
                />
                <div
                  className={`absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm ${FILL[r.result]}`}
                  style={{ left: `${x(r.date)}%` }}
                />
              </div>
              <span className="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
                {fmt(r.date)} <span className={INK[r.result]}>{r.result === "bad" ? badLabel : "good"}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 sm:px-5 dark:border-gray-700 dark:text-gray-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
          remaining range
        </span>
        <span className="ml-auto tabular-nums">
          {fmt(lo)} → {fmt(hi)}
          {days > 0 && ` (${days} ${days === 1 ? "day" : "days"})`}
          {culprit && <>, {culprit}</>}
        </span>
      </figcaption>
    </figure>
  );
}
