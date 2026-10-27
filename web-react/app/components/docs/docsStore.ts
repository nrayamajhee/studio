import { useSyncExternalStore } from "react";

// The docs sidebar's folded folders, by path, persisted in localStorage so
// they stay folded from page to page and visit to visit.
export const DOCS_COLLAPSED_KEY = "studio.docsCollapsed";
const NONE: readonly string[] = [];

let collapsed: readonly string[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(DOCS_COLLAPSED_KEY) ?? "null",
    );
    return Array.isArray(stored)
      ? stored.filter((path): path is string => typeof path === "string")
      : NONE;
  } catch {
    return NONE;
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => (collapsed ??= read());

// The folded folders now, outside React (e.g. right after loading, while the
// page still shows the server's none).
export const docsCollapsed = getSnapshot;

export function useDocsCollapsed() {
  return useSyncExternalStore(subscribe, getSnapshot, () => NONE);
}

export function setDocsCollapsed(next: readonly string[]) {
  collapsed = next;
  try {
    localStorage.setItem(DOCS_COLLAPSED_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}
