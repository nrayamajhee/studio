import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Button } from "../components/design-system/Button";
import { Card } from "../components/design-system/Card";
import { Title, Subtitle, Paragraph } from "../components/design-system/Typography";
import { Sun, Moon } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Studio" },
    {
      name: "description",
      content: "Studio component library and design system.",
    },
  ];
}

export default function Home() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    setIsDark(isCurrentlyDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
      } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#1c1917] dark:bg-[#141211] dark:text-[#fdfbf7] flex flex-col items-center justify-center p-4 sm:p-8 font-sans transition-colors duration-200">
      {/* Top Floating Regular Button as Theme Switcher */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <Button
          tone="secondary"
          size="sm"
          leadingIcon={
            isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-stone-700" />
            )
          }
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        />
      </div>

      <main className="w-full max-w-md">
        <Card className="flex flex-col gap-3">
          <Title level={1} size="2xl">
            Studio Design System
          </Title>
          <Subtitle>
            Minimal, composable, accessible UI components.
          </Subtitle>
          <Paragraph>
            Built with React 19, Tailwind CSS v4, and Storybook. All components feature centralized atmospheric color tokens, strict typography hierarchy, and dark mode support.
          </Paragraph>
        </Card>
      </main>
    </div>
  );
}
