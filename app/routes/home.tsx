import { Link } from "react-router";
import type { Route } from "./+types/home";
import { HotkeyProvider } from "../providers/HotkeyProvider";
import { SynthDevice } from "../components/home/SynthDevice";
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
          <Link
            to="https://github.com/nrayamajhee/studio"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            GitHub
          </Link>
        </span>
        <Link
          to="https://buymeacoffee.com/nrayamajhee"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 whitespace-nowrap font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
        >
          Buy me a coffee!
        </Link>
      </footer>

      <ThemeToggle />
    </div>
  );
}
