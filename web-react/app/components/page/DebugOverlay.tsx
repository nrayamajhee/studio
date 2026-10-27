import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { THEME_KEY, type Theme } from "../../hooks/useTheme";
import { tv } from "../../lib/utils";
import {
  useCommandKey,
  useCommandLegend,
} from "../../providers/HotkeyProvider";
import { Button } from "../design-system/Button";
import {
  PAD_CHORDS_KEY,
  PLAY_STYLES_KEY,
  PLAY_STYLE_KEY,
  usePadChords,
  usePlayStyle,
  useSavedPlayStyles,
} from "../home/chordStore";
import { FAVORITES_KEY, useFavorites } from "../home/favoritesStore";
import { MIDI_KEY, useMidiSettings } from "../home/input/midi";
import { PRESETS_KEY, usePresetLibrary } from "../home/presetStore";
import { DOCS_COLLAPSED_KEY, useDocsCollapsed } from "../docs/docsStore";
import {
  MODULES_KEY,
  PATTERN_KEY,
  TAKE_KEY,
  TAPES_KEY,
  TAPE_KEY,
  useSession,
} from "../home/sessionStore";

export type DebugOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

const TOGGLE_CODE = "KeyD";

const debugOverlay = tv({
  slots: {
    // Narrow, the header (with its close button) leads, then the keys, then
    // the state; wide, the keys run down the left beside the other two.
    base: "fixed inset-x-3 top-20 bottom-28 z-60 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/65 text-white/80 shadow-high backdrop-blur-xl sm:inset-x-8 sm:bottom-20 sm:grid sm:grid-cols-[16rem_minmax(0,1fr)] sm:grid-rows-[auto_minmax(0,1fr)]",
    sidebar:
      "flex max-h-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-white/10 p-2 sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:max-h-none sm:border-r sm:border-b-0",
    item: "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-xs hover:bg-white/5",
    written:
      "ml-auto size-1.5 shrink-0 animate-[fade-out_2s_ease-in_forwards] rounded-full bg-emerald-400",
    header:
      "flex min-w-0 items-center gap-3 border-b border-white/10 py-2 pr-2 pl-4 text-sm sm:col-start-2 sm:row-start-1",
    code: "min-h-0 min-w-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre text-white/80 sm:col-start-2 sm:row-start-2",
  },
  variants: {
    selected: {
      true: { item: "bg-white/10 text-white hover:bg-white/10" },
    },
  },
});
const ui = debugOverlay();

// The app's state that is kept in localStorage, by the key each part is kept
// under, read from the stores that keep it.
function useSavedState(): readonly (readonly [string, unknown])[] {
  const library = usePresetLibrary();
  const favorites = useFavorites();
  const padChords = usePadChords();
  const playStyle = usePlayStyle();
  const playStyles = useSavedPlayStyles();
  const { take, modules, pattern, tapes, tape } = useSession();
  const docsCollapsed = useDocsCollapsed();
  const midi = useMidiSettings();
  const [theme] = useLocalStorage<Theme>(THEME_KEY, "system");
  return [
    [PRESETS_KEY, library],
    [FAVORITES_KEY, favorites],
    [PAD_CHORDS_KEY, padChords],
    [PLAY_STYLE_KEY, playStyle],
    [PLAY_STYLES_KEY, playStyles],
    [TAKE_KEY, take],
    [MODULES_KEY, modules],
    [PATTERN_KEY, pattern],
    [TAPES_KEY, tapes],
    [TAPE_KEY, tape],
    [MIDI_KEY, midi],
    [DOCS_COLLAPSED_KEY, docsCollapsed],
    [THEME_KEY, theme],
  ];
}

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

// A dot that flashes each time `value` changes while it is shown.
function ChangeMark({ value }: { value: unknown }) {
  const [last, setLast] = useState(value);
  const [changes, setChanges] = useState(0);
  if (value !== last) {
    setLast(value);
    setChanges(changes + 1);
  }
  return changes > 0 ? <span key={changes} className={ui.written()} /> : null;
}

type SavedStateProps = {
  picked: string | undefined;
  onPick: (key: string) => void;
  onClose: () => void;
  className?: string;
};

function SavedState({ picked, onPick, onClose, className }: SavedStateProps) {
  const parts = useSavedState();
  const [key, value] = parts.find(([key]) => key === picked) ?? parts[0];
  const command = useCommandLegend();
  // Copy all: every key and its state as one JSON array of { key, value },
  // in the sidebar's order. The button says how it went for a moment.
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copyAll = () => {
    const json = JSON.stringify(
      parts.map(([key, value]) => ({ key, value })),
      null,
      2,
    );
    // No clipboard outside a secure page.
    (navigator.clipboard?.writeText(json) ?? Promise.reject()).then(
      () => setCopied("done"),
      () => setCopied("failed"),
    );
  };

  return (
    <aside aria-label="Saved state" className={ui.base({ className })}>
      <div className={ui.header()}>
        <span className="min-w-0 flex-1 truncate font-mono text-white">
          {key}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white"
          leadingIcon={
            copied === "done" ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )
          }
          aria-label="Copy every key's state as one JSON array"
          title={
            copied === "done"
              ? "Copied"
              : copied === "failed"
                ? "Couldn't copy"
                : "Copy all"
          }
          onClick={copyAll}
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white"
          leadingIcon={<X className="size-4" />}
          aria-label={`Close the saved state (${command}D)`}
          title={`Close (${command}D)`}
          onClick={onClose}
        />
      </div>
      <nav className={ui.sidebar()}>
        {parts.map(([part, value]) => (
          <Button
            unstyled
            key={part}
            className={ui.item({ selected: part === key })}
            onClick={() => onPick(part)}
          >
            <span className="min-w-0 truncate">{part}</span>
            <ChangeMark value={value} />
          </Button>
        ))}
      </nav>
      <pre className={ui.code()}>
        {highlight(JSON.stringify(value, null, 2))}
      </pre>
    </aside>
  );
}

// A dark see-through panel over the page showing the app's state that is
// kept in localStorage: the keys in the sidebar, and the picked one's state,
// read from its store, as pretty-printed JSON beside it. It follows the
// stores, so changes show as they happen and the key changed flashes. The
// keys still play the Device under it. ⌘D (Ctrl D) opens and closes it.
export function DebugOverlay({
  open,
  onOpenChange,
  className,
}: DebugOverlayProps) {
  const [picked, setPicked] = useState<string>();
  useCommandKey(TOGGLE_CODE, () => onOpenChange(!open));

  if (!open) return null;
  return (
    <SavedState
      picked={picked}
      onPick={setPicked}
      onClose={() => onOpenChange(false)}
      className={className}
    />
  );
}
