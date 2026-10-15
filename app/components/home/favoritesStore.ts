import { useSyncExternalStore } from "react";

// The pickers that keep favorites, and each one's starred items, by id, in
// the order starred, persisted in localStorage. They lead their picker, on a
// page of their own.
export type FavoriteKind =
  "instruments" | "chords" | "playStyles" | "progressions" | "beats";
export type Favorites = Readonly<Record<FavoriteKind, readonly string[]>>;

const STORAGE_KEY = "studio.favorites";
const NO_FAVORITES: Favorites = {
  instruments: [],
  chords: [],
  playStyles: [],
  progressions: [],
  beats: [],
};

let favorites: Favorites | null = null;
const listeners = new Set<() => void>();

const ids = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];

function read(): Favorites {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return {
      instruments: ids(stored?.instruments),
      chords: ids(stored?.chords),
      playStyles: ids(stored?.playStyles),
      progressions: ids(stored?.progressions),
      beats: ids(stored?.beats),
    };
  } catch {
    return NO_FAVORITES;
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => (favorites ??= read());

export function useFavorites() {
  return useSyncExternalStore(subscribe, getSnapshot, () => NO_FAVORITES);
}

// Stars an item, or lets a starred one go; returns its picker's favorites as
// they are now.
export function toggleFavorite(
  kind: FavoriteKind,
  id: string,
): readonly string[] {
  const current = getSnapshot();
  const next = current[kind].includes(id)
    ? current[kind].filter((candidate) => candidate !== id)
    : [...current[kind], id];
  favorites = { ...current, [kind]: next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
  return next;
}
