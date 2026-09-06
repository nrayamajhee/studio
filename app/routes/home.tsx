import React, { useState } from "react";
import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useTheme } from "../hooks/useTheme";
import { useStudioStorage } from "../lib/studioStorage";
import { Button } from "../components/design-system/Button";
import { Card } from "../components/design-system/Card";
import {
  Heading,
  Subtitle,
  Paragraph,
} from "../components/design-system/Typography";
import {
  type MockUser,
  PRESET_MOCK_USERS,
} from "../lib/mockUser";
import { cn } from "../lib/utils";
import {
  Sliders,
  Sparkles,
  LogOut,
  UserCheck,
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

const AVATAR_OPTIONS = ["🎹", "🎧", "⚡", "🥁", "🎙️", "🎛️", "🎼", "🔥"];

export default function Home() {
  const { theme, nextTheme, cycleTheme } = useTheme();

  const [studio, setStudio] = useStudioStorage();
  const user = studio.user ?? null;

  const setUser = (nextUser: MockUser | null) => {
    setStudio((prev) => ({ ...prev, user: nextUser }));
  };

  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("Producer");
  const [selectedAvatar, setSelectedAvatar] = useState("🎹");
  const [isCustomMode, setIsCustomMode] = useState(false);

  const handleSelectMockUser = (preset: MockUser) => {
    setUser({ ...preset });
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;

    const newUser: MockUser = {
      id: `user_${trimmed.toLowerCase().replace(/\s+/g, "_")}`,
      name: trimmed,
      role: customRole.trim() || "Producer",
      avatar: selectedAvatar,
      email: `${trimmed.toLowerCase().replace(/\s+/g, "")}@studio.local`,
      loggedAt: 0,
    };
    setUser(newUser);
  };

  const handleSignOut = () => {
    setUser(null);
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
          /* Logged In State Card */
          <Card
            elevation="high"
            className="w-full p-5 sm:p-6 rounded-2xl bg-white/90 dark:bg-[#0d111a]/90 backdrop-blur-md border border-stone-200 dark:border-[#1f2533] shadow-xl text-left space-y-5"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#1a202c] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl shadow-inner">
                  {user.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                      {user.name}
                    </h3>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                    {user.role}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                tone="secondary"
                size="sm"
                onClick={handleSignOut}
                title="Switch Profile / Sign Out"
                aria-label="Sign Out"
                className="h-8 px-2.5 text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sign Out
              </Button>
            </div>

            {/* Quick Switch Profiles */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Switch Producer Profile (LocalStorage Synced):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_MOCK_USERS.map((preset) => {
                  const isCurrent = user.id === preset.id;
                  return (
                    <Button
                      key={preset.id}
                      variant={isCurrent ? "solid" : "outline"}
                      tone={isCurrent ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => handleSelectMockUser(preset)}
                      className={cn(
                        "flex items-center gap-1.5 py-1.5 px-2 h-auto text-xs justify-start rounded-lg transition-all",
                        isCurrent
                          ? "shadow-sm ring-1 ring-primary"
                          : "bg-stone-50 dark:bg-[#121622] hover:bg-stone-100 dark:hover:bg-[#1a2130] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-[#232a3b]",
                      )}
                    >
                      <span className="text-sm">{preset.avatar}</span>
                      <span className="truncate text-[11px] font-medium">
                        {preset.name.split(" ")[0]}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
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
          /* Log In Form Card */
          <Card
            elevation="high"
            className="w-full p-5 sm:p-6 rounded-2xl bg-white/90 dark:bg-[#0d111a]/90 backdrop-blur-md border border-stone-200 dark:border-[#1f2533] shadow-xl text-left space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  Producer Sign In
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Select a mock profile or create your producer alias.
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>

            {/* Preset Profiles */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                Quick Sign In:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_MOCK_USERS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    tone="secondary"
                    size="sm"
                    onClick={() => handleSelectMockUser(preset)}
                    className="flex items-center gap-2.5 p-2 h-auto text-left rounded-xl bg-stone-50 dark:bg-[#121622] hover:bg-stone-100 dark:hover:bg-[#1a2130] border-stone-200 dark:border-[#232a3b] text-stone-800 dark:text-stone-200 transition-all justify-start"
                  >
                    <span className="text-xl">{preset.avatar}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                        {preset.role}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom login accordion / toggle */}
            {!isCustomMode ? (
              <div className="pt-2 text-center">
                <Button
                  variant="ghost"
                  tone="secondary"
                  size="sm"
                  onClick={() => setIsCustomMode(true)}
                  className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                  Or create custom alias...
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleCustomLogin}
                className="space-y-3 pt-2 border-t border-stone-200 dark:border-[#1a202c]"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="custom-producer-name"
                    className="text-xs font-medium text-stone-700 dark:text-stone-300"
                  >
                    Producer Name
                  </label>
                  <input
                    id="custom-producer-name"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Jordan Beats"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0a0d14] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="custom-producer-role"
                    className="text-xs font-medium text-stone-700 dark:text-stone-300"
                  >
                    Role / Style
                  </label>
                  <input
                    id="custom-producer-role"
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="e.g. Beatmaker, Sound Designer"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0a0d14] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-stone-700 dark:text-stone-300 block">
                    Choose Avatar
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {AVATAR_OPTIONS.map((av) => (
                      <Button
                        key={av}
                        variant={selectedAvatar === av ? "solid" : "ghost"}
                        tone={selectedAvatar === av ? "primary" : "secondary"}
                        size="sm"
                        type="button"
                        onClick={() => setSelectedAvatar(av)}
                        className={cn(
                          "w-7 h-7 p-0 rounded-lg text-sm flex items-center justify-center",
                          selectedAvatar === av
                            ? "ring-2 ring-primary scale-110"
                            : "hover:bg-stone-200 dark:hover:bg-stone-800",
                        )}
                      >
                        {av}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    tone="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setIsCustomMode(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="solid"
                    tone="primary"
                    size="sm"
                    type="submit"
                    disabled={!customName.trim()}
                    className="flex-1 text-xs"
                  >
                    Save & Enter Studio
                  </Button>
                </div>
              </form>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
