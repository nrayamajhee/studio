import { useEffect } from "react";
import { useLocalStorage, useMediaQuery } from "usehooks-ts";

export type Theme = "light" | "dark" | "system";

export const getNextTheme = (currentTheme: Theme): Theme => {
  if (currentTheme === "system") {
    return document.documentElement.classList.contains("dark") === true
      ? "light"
      : "dark";
  }
  return currentTheme === "light" ? "dark" : "light";
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

  const nextTheme = getNextTheme(
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme,
  );

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
