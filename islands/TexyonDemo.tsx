import { TexyonEngine, type CompileResult, type LoadProgress, type PageRaster } from "@texyon/wasm";
import { useEffect, useRef, useState } from "react";

type Props = {
  source: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "loading"; phase: LoadProgress["phase"] }
  | { kind: "ready"; ms: number; outcome: CompileResult["outcome"] }
  | { kind: "failed"; message: string };

type Page = {
  size: [number, number];
  bitmap?: ImageBitmap;
};

// The demo shows every page, so every changed page is drawn with its compile.
const ALL_PAGES: [number, number] = [0, 1_000_000];

const PHASE: Record<LoadProgress["phase"], string> = {
  "fetching-module": "Downloading the engine",
  instantiating: "Starting the engine",
  "fetching-pack": "Downloading LaTeX",
  "indexing-bundle": "Indexing packages",
  ready: "Ready",
};

export default function TexyonDemo({ source }: Props) {
  const [text, setText] = useState(source.trim() + "\n");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pages, setPages] = useState<Page[]>([]);
  const engine = useRef<TexyonEngine | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef(text);
  const busy = useRef(false);
  const scale = useRef<number | undefined>(undefined);
  const pageWidth = useRef(0);
  const pageCount = useRef(0);

  latest.current = text;

  function place(rasters: PageRaster[]) {
    setPages((old) => {
      const next = old.slice();
      for (const raster of rasters) {
        const page = next[raster.index];
        if (page !== undefined) next[raster.index] = { ...page, bitmap: raster.bitmap };
      }
      return next;
    });
  }

  // Pixels per big point that make the first page fill the panel sharply.
  function fit(): number | undefined {
    const el = panel.current;
    if (el === null || pageWidth.current === 0) return undefined;
    const style = getComputedStyle(el);
    const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return (width / pageWidth.current) * devicePixelRatio;
  }

  async function redraw() {
    const current = engine.current;
    const target = fit();
    if (current === null || target === undefined) return;
    if (scale.current !== undefined && Math.abs(target / scale.current - 1) < 0.01) return;
    scale.current = target;
    place(await current.raster([...Array(pageCount.current).keys()], target));
  }

  // One compile at a time, always on the newest text, so fast typing never builds a queue.
  async function typeset() {
    const current = engine.current;
    if (current === null || busy.current) return;
    busy.current = true;
    try {
      let sent: string;
      do {
        sent = latest.current;
        const result = await current.compile(sent, ALL_PAGES, scale.current);
        if (!result.published) continue;
        pageWidth.current = result.pageSizes[0]?.[0] ?? 0;
        pageCount.current = result.pageCount;
        setPages((old) => result.pageSizes.map((size, i) => ({ size, bitmap: old[i]?.bitmap })));
        place(result.rasters);
        await redraw();
        setStatus({ kind: "ready", ms: result.stats.elapsedMs, outcome: result.outcome });
      } while (sent !== latest.current);
    } catch (error) {
      setStatus({ kind: "failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      busy.current = false;
    }
  }

  async function start() {
    setStatus({ kind: "loading", phase: "fetching-module" });
    try {
      engine.current = await TexyonEngine.create({
        raster: true,
        bundleUrl: "https://bundles.texyon.org/texlive2026.ttb",
        onProgress: (p) => setStatus((s) => (s.kind === "loading" ? { kind: "loading", phase: p.phase } : s)),
        onRecompileNeeded: () => void typeset(),
      });
      await typeset();
    } catch (error) {
      setStatus({ kind: "failed", message: error instanceof Error ? error.message : String(error) });
    }
  }

  useEffect(() => {
    void typeset();
  }, [text]);

  useEffect(() => {
    const el = panel.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => void redraw().catch(() => { }));
    observer.observe(el);
    return () => {
      observer.disconnect();
      void engine.current?.close();
    };
  }, []);

  return (
    <figure className="not-prose my-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-gray-200 px-4 pb-3 pt-4 sm:px-5 dark:border-gray-700">
        <div className="font-semibold text-gray-900 dark:text-white">Try it (more complete demo <a href="https://editor.texyon.org/sample" target="_blank" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">here</a>)</div>
        <StatusLine status={status} />
      </figcaption>
      <div className="grid sm:grid-cols-2">
        <textarea
          className="min-h-[22rem] w-full resize-y border-0 border-b border-gray-200 bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-gray-800 focus:outline-none focus:ring-0 sm:border-b-0 sm:border-r sm:px-5 dark:border-gray-700 dark:text-gray-200"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label="LaTeX source"
        />
        <div ref={panel} className="flex max-h-[32rem] flex-col gap-4 overflow-y-auto bg-gray-100 p-4 dark:bg-gray-800/60">
          {status.kind === "idle" ? (
            <div className="m-auto text-center">
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-md bg-[#2a78d6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2367bb] dark:bg-[#3987e5] dark:hover:bg-[#2a78d6]"
              >
                Run TeXyoN
              </button>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">(download 30 MB)</p>
            </div>
          ) : (
            pages.map((page, i) => <PageCanvas key={i} page={page} />)
          )}
        </div>
      </div>
    </figure>
  );
}

function PageCanvas({ page }: { page: Page }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (el === null || page.bitmap === undefined) return;
    el.width = page.bitmap.width;
    el.height = page.bitmap.height;
    el.getContext("bitmaprenderer")?.transferFromImageBitmap(page.bitmap);
  }, [page.bitmap]);
  const [width, height] = page.size;
  return (
    <canvas
      ref={canvas}
      className="block w-full shrink-0 bg-white shadow-sm"
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}

function StatusLine({ status }: { status: Status }) {
  const text =
    status.kind === "idle"
      ? ""
      : status.kind === "loading"
        ? `${PHASE[status.phase]}…`
        : status.kind === "failed"
          ? status.message
          : `Typeset in ${Math.round(status.ms)} ms${status.outcome === "errors" ? ", with errors" : ""}`;
  return (
    <div
      className={`text-sm tabular-nums ${status.kind === "failed" ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
      aria-live="polite"
    >
      {text}
    </div>
  );
}
