import React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
import { SynthDevice } from "../components/home/SynthDevice";
import { Sun, Moon } from "lucide-react";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio" },
    {
      name: "description",
      content: "Studio",
    },
  ];
}

export default function Home() {
  const { theme, nextTheme, cycleTheme } = useTheme();

  return (
    <div className="home-background relative w-full h-dvh overflow-hidden select-none">
      <div className="absolute inset-0 transition-opacity duration-400 ease-in-out opacity-100 dark:opacity-0 pointer-events-none">
        <div
          className="absolute -bottom-[60vmax] -left-[60vmax] w-[120vmax] h-[120vmax] animate-sunset-traverse mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle closest-side at 50% 50%, rgba(255, 248, 221, 0.98) 0%, rgba(255, 232, 173, 0.88) 15%, rgba(255, 207, 134, 0.65) 32%, rgba(250, 183, 139, 0.36) 52%, rgba(239, 189, 184, 0.13) 72%, rgba(239, 189, 184, 0.025) 88%, rgba(239, 189, 184, 0) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 120% 60% at 50% 100%, rgba(246, 197, 163, 0.2) 0%, rgba(239, 189, 184, 0.07) 45%, rgba(239, 189, 184, 0) 100%)",
          }}
        />
      </div>

      <div className="absolute inset-0 transition-opacity duration-400 ease-in-out opacity-0 dark:opacity-100 pointer-events-none">
        <div
          className="absolute -bottom-[45vmax] -left-[45vmax] w-[90vmax] h-[90vmax] animate-sunset-traverse mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle closest-side at 50% 50%, rgba(167, 185, 211, 0.3) 0%, rgba(144, 165, 196, 0.23) 18%, rgba(112, 137, 173, 0.14) 38%, rgba(89, 103, 129, 0.06) 60%, rgba(89, 103, 129, 0.015) 80%, rgba(89, 103, 129, 0) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 120% 60% at 50% 100%, rgba(124, 121, 140, 0.12) 0%, rgba(89, 103, 129, 0.04) 45%, rgba(89, 103, 129, 0) 100%)",
          }}
        />
      </div>

      <main className="absolute inset-0 z-10 py-20">
        <SynthDevice />
      </main>

      <footer
        className="absolute inset-x-0 bottom-6 z-10 text-center text-sm select-text"
        style={{
          color: "color-mix(in srgb, #000000, #ffffff var(--theme-mix))",
        }}
      >
        <Link
          to="https://nishan.rayamajhee.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
        >
          Nishan Rayamajhee
        </Link>
      </footer>

      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <Button
          variant="solid"
          tone="secondary"
          rounded
          size="sm"
          className="bg-white/50 dark:bg-white/50 backdrop-blur-xl shadow-low border-2 border-white/45 dark:border-white/15 text-font dark:text-surface transition-all duration-400 hover:bg-white/65 dark:hover:bg-white/65"
          leadingIcon={
            nextTheme === "light" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )
          }
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Click to switch to ${nextTheme}.`}
        />
      </div>
    </div>
  );
}
