import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { HotkeyProvider } from "../providers/HotkeyProvider";
import { SynthDevice } from "../components/home/SynthDevice";
import { Button } from "../components/design-system/Button";
import { DebugOverlay } from "../components/page/DebugOverlay";
import { MidiButton, MidiPanel } from "../components/page/MidiPanel";
import { SkyBackground } from "../components/page/SkyBackground";
import { ThemeToggle } from "../components/page/ThemeToggle";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio" },
    {
      name: "description",
      content: "A quiet place for loud ideas by Nishan Rayamajhee",
    },
  ];
}

export default function Home() {
  // One panel over the page at a time.
  const [panel, setPanel] = useState<"debug" | "midi" | null>(null);
  const panelOpener = (name: "debug" | "midi") => (open: boolean) =>
    setPanel((current) => (open ? name : current === name ? null : current));
  const setDebugOpen = panelOpener("debug");
  const setMidiOpen = panelOpener("midi");

  return (
    <div className="relative w-full h-dvh overflow-hidden select-none">
      <SkyBackground />

      <main className="absolute inset-0 z-10 py-20">
        <HotkeyProvider>
          <SynthDevice />
        </HotkeyProvider>
      </main>

      <footer className="absolute inset-x-0 bottom-6 z-10 text-sm text-sky-ink select-text flex items-end justify-between gap-4 px-6 sm:px-8">
        <span>
          A quiet place for loud ideas by <br className="sm:hidden" />
          <Link
            to="https://nishan.rayamajhee.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            Nishan Rayamajhee
          </Link>
          {" | "}
          <Link
            to="/docs"
            className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            Docs
          </Link>
          {" | "}
          <Button
            unstyled
            aria-expanded={panel === "debug"}
            onClick={() => setDebugOpen(panel !== "debug")}
            className="cursor-pointer font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            {/* An element, so Button doesn't set the label in its own type. */}
            <span>Debug</span>
          </Button>
        </span>
        <span className="shrink-0 whitespace-nowrap">
          <Link
            to="https://github.com/nrayamajhee/studio"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            GitHub
          </Link>
          {" | "}
          <Link
            to="https://buymeacoffee.com/nrayamajhee"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            Buy me a coffee!
          </Link>
        </span>
      </footer>

      <ThemeToggle>
        <MidiButton open={panel === "midi"} onOpenChange={setMidiOpen} />
      </ThemeToggle>
      <DebugOverlay open={panel === "debug"} onOpenChange={setDebugOpen} />
      <MidiPanel open={panel === "midi"} onOpenChange={setMidiOpen} />
    </div>
  );
}
