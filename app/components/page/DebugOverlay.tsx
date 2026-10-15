import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { tv } from "../../lib/utils";
import { Button } from "../design-system/Button";

export type DebugOverlayProps = {
  defaultOpen?: boolean;
  className?: string;
};

type Part = {
  key: string;
  raw: string;
  bytes: number;
  // When it was last written while the overlay was open (performance.now()),
  // or 0.
  writtenAt: number;
};

const TOGGLE_CODE = "Slash";
const POLL_MS = 300;
const ALL = "";

const debugOverlay = tv({
  slots: {
    base: "fixed inset-x-3 top-20 bottom-28 z-60 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/65 text-white/80 shadow-high backdrop-blur-xl sm:inset-x-8 sm:bottom-20 sm:flex-row",
    sidebar:
      "flex max-h-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-white/10 p-2 sm:max-h-none sm:w-64 sm:border-r sm:border-b-0",
    heading:
      "px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-white/50 uppercase",
    item: "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5",
    itemKey: "block truncate font-mono text-[11px] text-white/40",
    written:
      "size-1.5 shrink-0 animate-[fade-out_2s_ease-in_forwards] rounded-full bg-emerald-400",
    size: "ml-auto shrink-0 font-mono text-[11px] text-white/40 tabular-nums",
    main: "flex min-h-0 min-w-0 flex-1 flex-col",
    header:
      "flex items-center gap-3 border-b border-white/10 py-2 pr-2 pl-4 text-sm",
    code: "min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre text-white/80",
    empty: "p-4 text-sm text-white/50",
  },
  variants: {
    selected: {
      true: { item: "bg-white/10 text-white hover:bg-white/10" },
    },
  },
});
const ui = debugOverlay();

const typing = (event: KeyboardEvent) =>
  event.target instanceof Element &&
  event.target.closest("input, textarea, select, [contenteditable]") !== null;

const isDevice = (key: string) => key.startsWith("studio.");

// "studio.padChords" → "Pad chords".
const partName = (key: string) => {
  const name = key
    .replace(/^studio\./, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;

const encoder = new TextEncoder();

// Every key in localStorage with its value, the Device's first.
function readStorage(): [string, string][] {
  try {
    return Object.keys(localStorage)
      .sort(
        (a, b) =>
          Number(isDevice(b)) - Number(isDevice(a)) || a.localeCompare(b),
      )
      .map((key) => [key, localStorage.getItem(key) ?? ""]);
  } catch {
    return [];
  }
}

// What localStorage holds, read again every POLL_MS while `watching`, since
// a tab's own writes fire no storage event. A part written since the
// previous read is stamped with when.
function useStorageParts(watching: boolean) {
  const [parts, setParts] = useState<readonly Part[]>([]);
  useEffect(() => {
    if (!watching) return;
    const read = (stamp: number) =>
      setParts((previous) => {
        const before = new Map(previous.map((part) => [part.key, part]));
        const next = readStorage().map(([key, raw]): Part => {
          const last = before.get(key);
          if (last?.raw === raw) return last;
          return {
            key,
            raw,
            bytes: encoder.encode(raw).length,
            writtenAt: stamp,
          };
        });
        return next.length === previous.length &&
          next.every((part, i) => part === previous[i])
          ? previous
          : next;
      });
    read(0);
    const timer = setInterval(() => read(performance.now()), POLL_MS);
    return () => {
      clearInterval(timer);
      // The marks go with the overlay, so reopening it doesn't replay them.
      setParts((current) => current.map((part) => ({ ...part, writtenAt: 0 })));
    };
  }, [watching]);
  return parts;
}

const parse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

// Pretty-printed JSON, its keys, strings, numbers and literals coloured.
function highlight(json: string) {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of json.matchAll(TOKEN)) {
    const [token, string, colon] = match;
    out.push(json.slice(at, match.index));
    const tone = colon
      ? "text-sky-300"
      : string
        ? "text-emerald-300"
        : /^[tfn]/.test(token)
          ? "text-violet-300"
          : "text-amber-300";
    out.push(
      <span key={match.index} className={tone}>
        {colon ? string : token}
      </span>,
      colon ?? "",
    );
    at = match.index + token.length;
  }
  out.push(json.slice(at));
  return out;
}

// A dark see-through panel over the page showing everything kept in
// localStorage: a part a row in the sidebar, the Device's first, and the
// picked part (or all of them) as pretty-printed JSON beside it. It keeps
// reading, so writes show as they happen, and a part just written flashes.
// The keys still play the Device under it. `/` opens and closes it.
export function DebugOverlay({
  defaultOpen = false,
  className,
}: DebugOverlayProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [picked, setPicked] = useState(ALL);
  const parts = useStorageParts(open);
  const part = parts.find(({ key }) => key === picked);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.code !== TOGGLE_CODE || event.repeat || typing(event)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    setOpen((current) => !current);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!open) return null;

  const shown = part
    ? parse(part.raw)
    : Object.fromEntries(parts.map(({ key, raw }) => [key, parse(raw)]));
  const json =
    typeof shown === "string" ? shown : JSON.stringify(shown, null, 2);
  const total = parts.reduce((sum, { bytes }) => sum + bytes, 0);

  const item = (key: string, label: string, detail?: Part) => (
    <Button
      unstyled
      key={key || "all"}
      className={ui.item({ selected: (part?.key ?? ALL) === key })}
      onClick={() => setPicked(key)}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {detail && <span className={ui.itemKey()}>{key}</span>}
      </span>
      {detail?.writtenAt ? (
        <span key={detail.writtenAt} className={ui.written()} />
      ) : null}
      <span className={ui.size()}>{formatBytes(detail?.bytes ?? total)}</span>
    </Button>
  );
  const device = parts.filter(({ key }) => isDevice(key));
  const other = parts.filter(({ key }) => !isDevice(key));

  return (
    <aside aria-label="Saved state" className={ui.base({ className })}>
      <nav className={ui.sidebar()}>
        {item(ALL, `Everything · ${parts.length}`)}
        {device.length > 0 && <div className={ui.heading()}>Device</div>}
        {device.map((detail) => item(detail.key, partName(detail.key), detail))}
        {other.length > 0 && <div className={ui.heading()}>Other</div>}
        {other.map((detail) => item(detail.key, partName(detail.key), detail))}
      </nav>
      <div className={ui.main()}>
        <div className={ui.header()}>
          <span className="truncate font-mono text-white">
            {part ? part.key : "localStorage"}
          </span>
          <span className={ui.size()}>{formatBytes(part?.bytes ?? total)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white"
            leadingIcon={<X className="size-4" />}
            aria-label="Close the saved state (/)"
            title="Close (/)"
            onClick={() => setOpen(false)}
          />
        </div>
        {parts.length === 0 ? (
          <p className={ui.empty()}>Nothing is saved in localStorage yet.</p>
        ) : (
          <pre className={ui.code()}>{highlight(json)}</pre>
        )}
      </div>
    </aside>
  );
}
