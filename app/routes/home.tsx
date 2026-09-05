import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
import {
  Heading,
  Subtitle,
  Paragraph,
} from "../components/design-system/Typography";
import { Sun, Moon, Monitor } from "lucide-react";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio" },
    {
      name: "description",
      content: "A quiet, minimal canvas for loud ideas.",
    },
  ];
}

export default function Home() {
  const { theme, nextTheme, cycleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-100 to-blue-300 dark:from-blue-900 dark:via-blue-950 dark:to-stone-950 text-font dark:text-surface flex flex-col items-center justify-center p-4 sm:p-8 font-sans transition-colors duration-200 selection:bg-primary/30">
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <Button
          variant="solid"
          tone="secondary"
          rounded
          size="sm"
          className="bg-white/80 dark:bg-stone-800/80 backdrop-blur shadow-sm hover:bg-white dark:hover:bg-stone-700"
          leadingIcon={
            nextTheme === "light" ? (
              <Sun className="w-4 h-4" />
            ) : nextTheme === "dark" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Monitor className="w-4 h-4" />
            )
          }
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Click to change.`}
        />
      </div>

      <main className="flex flex-col items-center text-center gap-6 max-w-md">
        <div className="flex flex-col items-center gap-1">
          <Paragraph>{"Nishan's"}</Paragraph>
          <Heading>Studio</Heading>
          <Subtitle>A quiet, minimal canvas for loud ideas.</Subtitle>
        </div>

        <Button asChild tone="primary" size="sm" rounded>
          <Link to="/mixer" replace>
            Go to Studio
          </Link>
        </Button>
      </main>
    </div>
  );
}
