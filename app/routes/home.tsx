import React from "react";
import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useTheme } from "../hooks/useTheme";
import { useStudioStorage } from "../lib/studioStorage";
import { Button } from "../components/design-system/Button";
import { Card } from "../components/design-system/Card";
import { GoogleIcon, AppleIcon } from "../components/design-system/Icons";
import {
  Heading,
  Subtitle,
  Paragraph,
} from "../components/design-system/Typography";
import {
  type MockUser,
  MOCK_GOOGLE_USER,
  MOCK_APPLE_USER,
} from "../lib/mockUser";
import { cn } from "../lib/utils";
import {
  Sliders,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ArrowRight,
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

  const [studio, setStudio] = useStudioStorage();
  const user = studio.user ?? null;

  const handleSignIn = (providerUser: MockUser) => {
    setStudio((prev) => ({
      ...prev,
      user: { ...providerUser, loggedAt: Date.now() },
    }));
  };

  const handleSignOut = () => {
    setStudio((prev) => ({ ...prev, user: null }));
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

      <main className="flex flex-col items-center text-center gap-6 max-w-lg w-full">
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

        {user ? (
          <Card
            elevation="high"
            className="w-full p-6 sm:p-7 rounded-2xl bg-white/90 dark:bg-[#0d111a]/90 backdrop-blur-md border border-stone-200 dark:border-[#1f2533] shadow-xl text-left space-y-6"
          >
            <div className="flex items-center justify-between border-b border-stone-200/60 dark:border-[#1c2230] pb-4">
              <div className="flex items-center gap-3.5">
                <div className="relative w-12 h-12 rounded-xl bg-stone-100 dark:bg-[#151a24] border border-stone-200 dark:border-[#232a3b] flex items-center justify-center shadow-inner">
                  {user.provider === "google" ? (
                    <GoogleIcon className="w-6 h-6" />
                  ) : (
                    <AppleIcon className="w-6 h-6 fill-current text-stone-900 dark:text-white" />
                  )}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#0d111a] rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                      {user.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                    {user.email}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                tone="secondary"
                size="sm"
                onClick={handleSignOut}
                title="Sign out of current account"
                aria-label="Sign Out"
                className="h-8 px-2.5 text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sign Out
              </Button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Switch Account (LocalStorage Synced):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={user.provider === "google" ? "solid" : "outline"}
                  tone={user.provider === "google" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleSignIn(MOCK_GOOGLE_USER)}
                  leadingIcon={<GoogleIcon className="w-4 h-4 flex-shrink-0" />}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 h-auto text-xs justify-start rounded-lg transition-all",
                    user.provider === "google"
                      ? "shadow-sm ring-1 ring-primary"
                      : "bg-stone-50 dark:bg-[#121622] hover:bg-stone-100 dark:hover:bg-[#1a2130] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-[#232a3b]",
                  )}
                >
                  <span className="truncate font-medium">Google Account</span>
                </Button>

                <Button
                  variant={user.provider === "apple" ? "solid" : "outline"}
                  tone={user.provider === "apple" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleSignIn(MOCK_APPLE_USER)}
                  leadingIcon={<AppleIcon className="w-4 h-4 flex-shrink-0 fill-current" />}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 h-auto text-xs justify-start rounded-lg transition-all",
                    user.provider === "apple"
                      ? "shadow-sm ring-1 ring-primary"
                      : "bg-stone-50 dark:bg-[#121622] hover:bg-stone-100 dark:hover:bg-[#1a2130] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-[#232a3b]",
                  )}
                >
                  <span className="truncate font-medium">Apple ID</span>
                </Button>
              </div>
            </div>

            <div className="pt-1">
              <Button asChild tone="primary" size="md" fullWidth rounded>
                <Link
                  to="/mixer"
                  replace
                  className="flex items-center justify-center gap-2 font-semibold"
                >
                  <Sliders className="w-4 h-4" />
                  Enter Studio
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card
            elevation="high"
            className="w-full p-6 sm:p-8 rounded-2xl bg-white/90 dark:bg-[#0d111a]/90 backdrop-blur-md border border-stone-200 dark:border-[#1f2533] shadow-xl text-left space-y-6"
          >
            <div className="space-y-1.5 text-center">
              <h2 className="font-bold text-stone-900 dark:text-stone-100 text-xl tracking-tight">
                Sign In
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Connect your account to sync synthesizers and sequencer patterns.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                tone="secondary"
                size="lg"
                fullWidth
                onClick={() => handleSignIn(MOCK_GOOGLE_USER)}
                leadingIcon={<GoogleIcon className="w-5 h-5 flex-shrink-0" />}
                className="bg-white dark:bg-[#121622] hover:bg-stone-50 dark:hover:bg-[#182030] text-stone-800 dark:text-stone-100 border-stone-300 dark:border-[#2a3449] font-medium shadow-sm transition-all flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm"
              >
                Continue with Google
              </Button>

              <Button
                variant="solid"
                tone="secondary"
                size="lg"
                fullWidth
                onClick={() => handleSignIn(MOCK_APPLE_USER)}
                leadingIcon={<AppleIcon className="w-5 h-5 flex-shrink-0 fill-current" />}
                className="bg-black text-white hover:bg-stone-900 active:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-100 dark:active:bg-stone-200 font-medium shadow-sm transition-all flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm border-transparent"
              >
                Continue with Apple
              </Button>
            </div>

            <div className="pt-2 border-t border-stone-200/60 dark:border-[#1c2230] text-center">
              <p className="text-[11px] text-stone-400 dark:text-stone-500 font-mono leading-relaxed">
                Mock provider sign-in. State syncs directly to local storage.
              </p>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
