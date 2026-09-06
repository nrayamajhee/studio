import React from "react";
import type { Route } from "./+types/home";
import { useNavigate } from "react-router";
import { useTheme } from "../hooks/useTheme";
import { useStudioStorage } from "../lib/studioStorage";
import { Button } from "../components/design-system/Button";
import { GoogleIcon } from "../components/design-system/Icons";
import {
  Heading,
  Subtitle,
  Paragraph,
} from "../components/design-system/Typography";
import { MOCK_GOOGLE_USER } from "../lib/mockUser";
import {
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio - Modal Synthesizer & Piano Roll Sequencer" },
    {
      name: "description",
      content:
        "Professional browser-based synthesizer and 10-octave piano roll sequencer.",
    },
  ];
}

export default function Home() {
  const { theme, nextTheme, cycleTheme } = useTheme();
  const navigate = useNavigate();

  const [, setStudio] = useStudioStorage();

  const handleGoogleLogin = () => {
    setStudio((prev) => ({
      ...prev,
      user: { ...MOCK_GOOGLE_USER, loggedAt: Date.now() },
    }));
    navigate("/mixer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-stone-100 to-stone-200 dark:from-[#06080c] dark:via-[#0c1017] dark:to-[#121622] text-stone-900 dark:text-stone-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans transition-colors duration-200 selection:bg-primary/30">
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <Button
          variant="solid"
          tone="secondary"
          rounded
          size="sm"
          className="bg-white/80 dark:bg-[#151a24]/80 backdrop-blur shadow-sm hover:bg-white dark:hover:bg-[#1d2433] border border-stone-200 dark:border-[#232a3b]"
          leadingIcon={
            nextTheme === "light" ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : nextTheme === "dark" ? (
              <Moon className="w-4 h-4 text-blue-400" />
            ) : (
              <Monitor className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            )
          }
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Click to change.`}
        />
      </div>

      <main className="flex flex-col items-center text-center gap-6 max-w-md w-full">
        <div className="flex flex-col items-center gap-1.5">
          <Paragraph className="text-stone-500 dark:text-stone-400 tracking-wider uppercase text-xs font-mono">
            {"Nishan's"}
          </Paragraph>
          <Heading className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Studio
          </Heading>
          <Subtitle className="text-stone-600 dark:text-stone-400 text-sm">
            A quiet, minimal canvas for loud ideas.
          </Subtitle>
        </div>

        <Button
          variant="outline"
          tone="secondary"
          size="md"
          rounded
          onClick={handleGoogleLogin}
          leadingIcon={<GoogleIcon className="w-4 h-4 flex-shrink-0" />}
          className="bg-white dark:bg-[#121622] hover:bg-stone-50 dark:hover:bg-[#182030] text-stone-800 dark:text-stone-100 border-stone-300 dark:border-[#2a3449] font-medium shadow-sm transition-all px-5 py-2.5"
        >
          Login with Google
        </Button>
      </main>
    </div>
  );
}
