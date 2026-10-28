import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "../design-system/Button";

export type ThemeToggleProps = {
  // Other frosted buttons, to the toggle's left.
  children?: ReactNode;
  className?: string;
};

// A frosted round button, as the theme toggle is.
export function CornerButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="solid"
      tone="secondary"
      rounded
      size="sm"
      className={cn(
        "bg-white/50 dark:bg-white/50 backdrop-blur-xl shadow-low border-2 border-white/45 dark:border-white/15 text-font dark:text-surface transition-all duration-400 hover:bg-white/65 dark:hover:bg-white/65",
        className,
      )}
      {...props}
    />
  );
}

// The frosted light/dark switch pinned to a page's top-right corner.
export function ThemeToggle({ children, className }: ThemeToggleProps) {
  const { theme, nextTheme, cycleTheme } = useTheme();

  return (
    <div
      className={cn(
        "fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex gap-2",
        className,
      )}
    >
      {children}
      <CornerButton
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
  );
}
