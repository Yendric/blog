import { useState, type ReactNode } from "react";

type Variant = "before" | "split" | "deferred" | "fixed";
type Tone = "neutral" | "warn" | "danger" | "ok";

type Row =
  | { kind: "frame"; label: string; caption: string }
  | { kind: "content" | "gpu"; label: ReactNode; tone?: Tone; caption: string }
  | { kind: "send" | "reply"; label: string; detail?: ReactNode; note?: string; tone?: Tone; caption: string };

type Props = {
  variants?: Variant[];
  initial?: Variant;
};

const TABS: Record<Variant, string> = {
  before: "Before",
  split: "Bug 1982053",
  deferred: "+ bug 2078982",
  fixed: "Fixed",
};

const c = (s: string) => <code>{s}</code>;

const SNAPSHOT: Row = {
  kind: "frame",
  label: "Offscreen transaction (view transition snapshot)",
  caption:
    "The view transition first paints a snapshot of the page as it currently is. This paint is sent as an offscreen transaction, which the parent computes for the animation, but doesn't show on screen.",
};

const NEXT: Row = {
  kind: "frame",
  label: "Next regular transaction",
  caption: "Some time later, the content process sends its next regular transaction.",
};

const REPLACE: Row = {
  kind: "content",
  label: <>snapshot repaints the canvas: new texture, T unused</>,
  caption:
    "The snapshot also repaints our canvas. Every time Firefox paints the canvas, it uploads the bitmap into a new texture (even if it didn't change), so the old texture T is no longer needed.",
};

const REMOVE = (queue: string, tone?: Tone, caption?: string): Row => ({
  kind: "content",
  label: <>{c("OpRemoveTexture(ptr)")} → {c(queue)}</>,
  tone,
  caption:
    caption ??
    `The content process asks the parent to stop using the old texture (OpRemoveTexture), and queues that message in ${queue}. It holds a raw pointer to the TextureChild (ptr)!`,
});

const DESTROY: Row = {
  kind: "content",
  label: <>{c("OpDestroy(T)")} → {c("mDestroyedActors")}</>,
  caption: "It also asks the parent to destroy its actor (TextureParent, via OpDestroy). This one goes into a separate list, mDestroyedActors.",
};

const DESTROY_PARENT: Row = {
  kind: "gpu",
  label: <>{c("DestroyActors")}: T destroyed</>,
  caption: "The parent process receives the OpDestroy and destroys its side of the texture.",
};

const DELETE: Row = {
  kind: "reply",
  label: "__delete__(T)",
  caption: "It replies with __delete__, telling the content process it can free its actor as well.",
};

const ROWS: Record<Variant, Row[]> = {
  before: [
    SNAPSHOT,
    REPLACE,
    REMOVE("mParentCommands"),
    DESTROY,
    {
      kind: "send",
      label: "SetDisplayList",
      detail: <>commands: {c("OpRemoveTexture(ptr)")}<br />destroy: {c("OpDestroy(T)")}</>,
      note: "ptr->Id() read while alive",
      tone: "ok",
      caption: "EndTransaction sends both queues in one message. Writing OpRemoveTexture calls ptr->Id(), and T is still alive.",
    },
    {
      kind: "gpu",
      label: <>decode {c("OpRemoveTexture")}: T found</>,
      tone: "ok",
      caption: "The parent decodes the whole message first, so the actor ID in OpRemoveTexture still resolves.",
    },
    DESTROY_PARENT,
    DELETE,
    {
      kind: "content",
      label: <>{c("TextureChild")} T freed</>,
      tone: "ok",
      caption: "The content process frees T. Nothing refers to it anymore.",
    },
  ],
  split: [
    SNAPSHOT,
    REPLACE,
    REMOVE(
      "mParentDestroyCommands",
      "warn",
      "Since bug 1982053, removal ops go into mParentDestroyCommands, which an offscreen transaction does not include in its display list.",
    ),
    DESTROY,
    {
      kind: "send",
      label: "SetDisplayList (offscreen)",
      detail: <>destroy: {c("OpDestroy(T)")}</>,
      tone: "warn",
      caption: "The offscreen display list goes out without OpRemoveTexture, but mDestroyedActors is sent as always.",
    },
    {
      kind: "send",
      label: "ParentCommands",
      detail: <>commands: {c("OpRemoveTexture(ptr)")}</>,
      note: "ptr->Id() read while alive",
      tone: "warn",
      caption:
        "Right after, still inside EndTransaction, ProcessWebRenderParentCommands merges the deferred queue and sends it as its own message. T is still alive, so the write is fine.",
    },
    DESTROY_PARENT,
    {
      kind: "gpu",
      label: <>decode {c("OpRemoveTexture")}: T not found</>,
      tone: "danger",
      caption: "The next message names an actor the parent just destroyed. The actor lookup fails and deserialization fails.",
    },
    {
      kind: "gpu",
      label: <>IPC FatalError, process aborts</>,
      tone: "danger",
      caption:
        "IPDL treats a failed deserialization as a protocol error and aborts the parent process, which takes the whole browser down.",
    },
  ],
  deferred: [
    SNAPSHOT,
    REPLACE,
    REMOVE(
      "mParentDestroyCommands",
      "warn",
      "The content process asks the parent to stop using the old texture (OpRemoveTexture), and queues that message in mParentDestroyCommands. It holds a raw pointer to the TextureChild (ptr)!",
    ),
    DESTROY,
    {
      kind: "send",
      label: "SetDisplayList (offscreen)",
      detail: <>destroy: {c("OpDestroy(T)")}</>,
      tone: "warn",
      caption: "In an offscreen transaction like our view transition snapshot, OpDestroy is sent to the parent.",
    },
    {
      kind: "content",
      label: <>no flush after offscreen</>,
      tone: "warn",
      caption:
        "OpRemoveTexture, however, stays in the queue until the next regular transaction.",
    },
    DESTROY_PARENT,
    DELETE,
    {
      kind: "content",
      label: <>T freed, {c("ptr")} now dangles</>,
      tone: "danger",
      caption: "The content process handles __delete__ before the next regular transaction, freeing the TextureChild. The queued OpRemoveTexture still holds a pointer to it.",
    },
    NEXT,
    {
      kind: "content",
      label: <>merge {c("mParentDestroyCommands")}</>,
      caption: "As this is a regular transaction, the held-back OpRemoveTexture is added to it.",
    },
    {
      kind: "send",
      label: "SetDisplayList",
      detail: <>commands: {c("OpRemoveTexture(ptr)")}</>,
      note: "ptr->Id() reads freed memory",
      tone: "danger",
      caption: "When the content process tries to send that message, it reads the actor ID from the freed pointer (ptr->Id()), resulting in a UAF.",
    },
  ],
  fixed: [
    SNAPSHOT,
    REPLACE,
    REMOVE("mParentDestroyCommands", undefined, "The removal op is still deferred, and still holds a raw pointer."),
    DESTROY,
    {
      kind: "send",
      label: "SetDisplayList (offscreen)",
      detail: "both held back",
      tone: "ok",
      caption: "Offscreen transactions now keep mDestroyedActors queued too, so nothing tells the parent to destroy T yet.",
    },
    NEXT,
    {
      kind: "send",
      label: "SetDisplayList",
      detail: <>commands: {c("OpRemoveTexture(ptr)")}<br />destroy: {c("OpDestroy(T)")}</>,
      note: "ptr->Id() read while alive",
      tone: "ok",
      caption: "Both queues leave together, so ptr is serialized while T is alive.",
    },
    {
      kind: "gpu",
      label: <>decode {c("OpRemoveTexture")}: T found</>,
      tone: "ok",
      caption: "The parent decodes the remove before it destroys anything.",
    },
    DESTROY_PARENT,
    DELETE,
    {
      kind: "content",
      label: <>{c("TextureChild")} T freed</>,
      tone: "ok",
      caption: "Only now is T freed, after the last op referencing it has been sent.",
    },
  ],
};

const TEXT: Record<Tone, string> = {
  neutral: "text-gray-700 dark:text-gray-300",
  warn: "text-[#a15c00] dark:text-[#f0b440]",
  danger: "text-[#c2410c] dark:text-[#f59a72]",
  ok: "text-[#13865d] dark:text-[#45cf9b]",
};
const BAR: Record<Tone, string> = {
  neutral: "bg-gray-300 dark:bg-gray-500",
  warn: "bg-[#eda100] dark:bg-[#c98500]",
  danger: "bg-[#eb6834] dark:bg-[#d95926]",
  ok: "bg-[#1baf7a] dark:bg-[#199e70]",
};
const TAG: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300",
  warn: "bg-[#eda100]/10 text-[#a15c00] dark:bg-[#c98500]/20 dark:text-[#f0b440]",
  danger: "bg-[#eb6834]/10 text-[#c2410c] dark:bg-[#d95926]/20 dark:text-[#f59a72]",
  ok: "bg-[#1baf7a]/10 text-[#13865d] dark:bg-[#199e70]/20 dark:text-[#45cf9b]",
};
const ARROW: Record<Tone, { line: string; head: string }> = {
  neutral: { line: "bg-gray-500 dark:bg-gray-400", head: "fill-gray-500 dark:fill-gray-400" },
  ok: { line: "bg-gray-500 dark:bg-gray-400", head: "fill-gray-500 dark:fill-gray-400" },
  warn: { line: "bg-[#eda100] dark:bg-[#c98500]", head: "fill-[#eda100] dark:fill-[#c98500]" },
  danger: { line: "bg-[#eb6834] dark:bg-[#d95926]", head: "fill-[#eb6834] dark:fill-[#d95926]" },
};

// The middle column's borders are the two lifelines, so every row draws its own segment.
const GRID = "grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]";
const LIFELINES = "border-x border-gray-300 dark:border-gray-600";

type State = "all" | "current" | "past" | "future";

export default function UafSequence({ variants = ["before", "split", "deferred", "fixed"], initial }: Props) {
  const [variant, setVariant] = useState<Variant>(initial ?? variants[0] ?? "deferred");
  const [step, setStep] = useState<number | null>(null);
  const rows = ROWS[variant];
  const current = step === null ? undefined : rows[step];

  const pick = (v: Variant) => {
    setVariant(v);
    setStep(null);
  };

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-3 py-2 dark:border-gray-700" role="tablist">
          {variants.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={v === variant}
              onClick={() => pick(v)}
              className={`rounded-md px-3 py-1 text-sm ${
                v === variant
                  ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {TABS[v]}
            </button>
          ))}
        </div>
      )}

      <ol className="py-2 text-sm sm:hidden">
        {rows.map((row, i) => (
          <MobileRow
            key={`${variant}-${i}`}
            row={row}
            state={step === null ? "all" : i === step ? "current" : i < step ? "past" : "future"}
            onClick={() => setStep(i)}
          />
        ))}
      </ol>

      <div className="hidden overflow-x-auto sm:block">
        <div className="min-w-[40rem] px-4 pb-4 pt-4 text-sm">
          <Header />
          {rows.map((row, i) => (
            <RowView
              key={`${variant}-${i}`}
              row={row}
              state={step === null ? "all" : i === step ? "current" : i < step ? "past" : "future"}
              onClick={() => setStep(i)}
            />
          ))}
          <div className={`${GRID} h-4`}>
            <div />
            <div className={LIFELINES} />
            <div />
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
        <p className="min-h-[2.5rem] min-w-0 flex-1 basis-64 leading-snug text-gray-600 dark:text-gray-300">
          {current && (
            <>
              <span className="mr-2 tabular-nums text-gray-400 dark:text-gray-500">
                {step! + 1}/{rows.length}
              </span>
              {current.caption}
            </>
          )}
        </p>
        <div className="flex gap-1">
          <StepButton disabled={step === null || step === 0} onClick={() => setStep((s) => (s ? s - 1 : s))}>
            Back
          </StepButton>
          <StepButton disabled={step === rows.length - 1} onClick={() => setStep((s) => (s === null ? 0 : s + 1))}>
            {step === null ? "Step through" : "Next"}
          </StepButton>
          {step !== null && <StepButton onClick={() => setStep(null)}>Show all</StepButton>}
        </div>
      </figcaption>
    </figure>
  );
}

function Header() {
  return (
    <div className={`${GRID} items-start`}>
      <div className="relative h-14">
        <Participant className="right-0 translate-x-1/2">Content process</Participant>
      </div>
      <div className={`${LIFELINES} h-14`} />
      <div className="relative h-14">
        <Participant className="left-0 -translate-x-1/2">Parent process</Participant>
      </div>
    </div>
  );
}

function Participant({ children, sub, className }: { children: ReactNode; sub?: string; className: string }) {
  return (
    <div
      className={`absolute top-0 z-10 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-center dark:border-gray-600 dark:bg-gray-800 ${className}`}
    >
      <div className="font-medium leading-tight text-gray-900 dark:text-white">{children}</div>
      {sub && <div className="text-xs leading-tight text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

function StepButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
    >
      {children}
    </button>
  );
}

function RowView({ row, state, onClick }: { row: Row; state: State; onClick: () => void }) {
  const fade = state === "future" ? "opacity-20" : state === "past" ? "opacity-60" : "";
  const highlight = state === "current" ? "rounded bg-[#2a78d6]/[0.07] dark:bg-[#3987e5]/[0.12]" : "";
  const base = `${GRID} cursor-pointer transition-opacity duration-150 ${fade} ${highlight}`;

  if (row.kind === "frame") {
    return (
      <div onClick={onClick} className={`${base} pt-3`}>
        <div className="col-span-3 grid grid-cols-subgrid border-t border-gray-200 dark:border-gray-700">
          <div className="pb-1.5 pt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {row.label}
          </div>
          <div className={LIFELINES} />
          <div />
        </div>
      </div>
    );
  }

  const tone = row.tone ?? "neutral";

  if (row.kind === "send" || row.kind === "reply") {
    const right = row.kind === "send";
    const arrow = ARROW[tone];
    return (
      <div onClick={onClick} className={base}>
        <div />
        <div className={`${LIFELINES} px-0 py-2`}>
          <div className="px-3 text-center font-mono text-[13px] leading-tight text-gray-900 dark:text-white">
            {row.label}
          </div>
          <div className="relative mt-1 h-2">
            <div className={`absolute top-1/2 h-px -translate-y-1/2 ${arrow.line} ${right ? "left-0 right-1.5" : "left-1.5 right-0"}`} />
            <svg
              viewBox="0 0 8 8"
              className={`absolute top-0 h-2 w-2 ${arrow.head} ${right ? "right-0" : "left-0 rotate-180"}`}
              aria-hidden="true"
            >
              <path d="M0 0l8 4-8 4z" />
            </svg>
          </div>
          {row.detail && (
            <div className="mt-1 px-3 text-center text-xs leading-snug text-gray-500 dark:text-gray-400">{row.detail}</div>
          )}
          {row.note && (
            <div className="mt-1.5 text-center">
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TAG[tone]}`}>{row.note}</span>
            </div>
          )}
        </div>
        <div />
      </div>
    );
  }

  const left = row.kind === "content";
  const label = <div className={`py-2 leading-snug ${TEXT[tone]}`}>{row.label}</div>;
  return (
    <div onClick={onClick} className={base}>
      <div className="relative pr-4 text-right">{left && label}</div>
      <div className={`${LIFELINES} relative`}>
        <span className={`absolute inset-y-1.5 w-1.5 rounded-sm ${BAR[tone]} ${left ? "-left-[3.5px]" : "-right-[3.5px]"}`} />
      </div>
      <div className="relative pl-4">{!left && label}</div>
    </div>
  );
}

const LANE: Record<Row["kind"], string> = {
  frame: "",
  content: "Content process",
  gpu: "Parent process",
  send: "Content → Parent",
  reply: "Parent → Content",
};

function MobileRow({ row, state, onClick }: { row: Row; state: State; onClick: () => void }) {
  const fade = state === "future" ? "opacity-20" : state === "past" ? "opacity-60" : "";
  const highlight = state === "current" ? "bg-[#2a78d6]/[0.07] dark:bg-[#3987e5]/[0.12]" : "";
  const base = `cursor-pointer transition-opacity duration-150 ${fade} ${highlight}`;

  if (row.kind === "frame") {
    return (
      <li
        onClick={onClick}
        className={`${base} mt-2 border-t border-gray-200 px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-500 first:mt-0 first:border-t-0 dark:border-gray-700 dark:text-gray-400`}
      >
        {row.label}
      </li>
    );
  }

  const tone = row.tone ?? "neutral";
  const message = row.kind === "send" || row.kind === "reply";
  return (
    <li onClick={onClick} className={`${base} flex gap-3 px-4 py-1.5`}>
      <span className={`w-1 shrink-0 rounded-sm ${BAR[tone]}`} aria-hidden="true" />
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="text-xs text-gray-400 dark:text-gray-500">{LANE[row.kind]}</div>
        <div
          className={`leading-snug ${message ? "font-mono text-[13px] text-gray-900 dark:text-white" : TEXT[tone]}`}
        >
          {row.label}
        </div>
        {message && row.detail && (
          <div className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{row.detail}</div>
        )}
        {message && row.note && (
          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TAG[tone]}`}>{row.note}</span>
        )}
      </div>
    </li>
  );
}
