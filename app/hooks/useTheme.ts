import { useEffect } from "react";
import { useLocalStorage, useMediaQuery } from "usehooks-ts";

export type Theme = "light" | "dark" | "system";

export const getNextTheme = (
  currentTheme: Theme,
  isDarkPreferred: boolean,
): Theme => {
  if (isDarkPreferred) {
    return currentTheme === "system"
      ? "light"
      : currentTheme === "light"
        ? "dark"
        : "system";
  }
  return currentTheme === "system"
    ? "dark"
    : currentTheme === "dark"
      ? "light"
      : "system";
};

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>("theme", "system", {
    initializeWithValue: false,
  });

  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)", {
    initializeWithValue: false,
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isDark =
      theme === "dark" || (theme === "system" && systemPrefersDark);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, systemPrefersDark]);

  const nextTheme = getNextTheme(theme, systemPrefersDark);

  const cycleTheme = () => {
    setTheme(nextTheme);
  };

  return {
    theme,
    setTheme,
    nextTheme,
    cycleTheme,
    systemPrefersDark,
    isDark: theme === "dark" || (theme === "system" && systemPrefersDark),
  };
}

export default useTheme;
