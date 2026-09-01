import type { Route } from "./+types/mixer";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
import { Title, Caption } from "../components/design-system/Typography";
import { PianoRoll } from "../components/piano-roll/PianoRoll";
import { Sun, Moon, Monitor } from "lucide-react";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Mixer - Piano Roll - Studio" },
    {
      name: "description",
      content: "10-octave piano roll sequencer with interactive grid.",
    },
  ];
}

export default function Mixer() {
  const { theme, nextTheme, cycleTheme } = useTheme();

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden bg-surface text-font dark:bg-surface-dark dark:text-surface flex flex-col font-sans transition-colors duration-200">
      {/* Top Header Navigation */}
      <header className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-surface-light/90 dark:bg-stone-900/90 backdrop-blur-sm flex-shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <Title className="text-sm sm:text-base font-bold leading-tight">
              Piano Roll Mixer
            </Title>
            <Caption className="text-[11px] text-font-light dark:text-font-light hidden sm:inline-block">
              10 Octaves (C1 - C10) • 16-Step Sequencer
            </Caption>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            tone="secondary"
            rounded
            size="sm"
            leadingIcon={
              nextTheme === "light" ? (
                <Sun className="w-4 h-4 fill-current" />
              ) : nextTheme === "dark" ? (
                <Moon className="w-4 h-4 fill-current" />
              ) : (
                <Monitor className="w-4 h-4 fill-current" />
              )
            }
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Click to switch to ${nextTheme}.`}
          />
        </div>
      </header>

      {/* Main Piano Roll Container (Edge-to-Edge) */}
      <main className="flex-1 w-full h-full overflow-hidden flex flex-col p-0 m-0">
        <PianoRoll className="flex-1 w-full h-full" />
      </main>
    </div>
  );
}
