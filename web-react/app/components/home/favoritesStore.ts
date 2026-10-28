import { useSyncExternalStore } from "react";

// The pickers that keep favorites, and each one's starred items, by id, in
// the order starred, persisted in localStorage. They lead their picker, on a
// page of their own. A first visit starts with none.
export type FavoriteKind =
  "instruments" | "chords" | "playStyles" | "progressions" | "beats";
export type Favorites = Readonly<Record<FavoriteKind, readonly string[]>>;

export const FAVORITES_KEY = "studio.favorites";
const NO_FAVORITES: Favorites = {
  instruments: [],
  chords: [],
  playStyles: [],
  progressions: [],
  beats: [],
};

// Nishan's Picks, a page of their own after the favorites that can't be
// changed: Block, the pulses, the accented down-up, the folk strum and two
// arpeggios; Fast car, Starter 1's Suspended, Born in the U.S.A. and
// Homecoming; its New jack swing on the 808 kit and on the madal,
// Sixteenth hats, Madal kick kick hat and Lo-fi.
export const NISHANS_PICKS: Favorites = {
  instruments: [],
  chords: [],
  playStyles: [
    "block",
    "pulse",
    "accentPulse",
    "accentDownUp",
    "folkStrum",
    "upDown",
    "alberti",
  ],
  progressions: ["fastCar", "suspended", "bornInTheUsa", "homecoming"],
  beats: [
    "newJackSwing",
    "madalNewJackSwing",
    "sixteenthHats",
    "madalKickKickHat",
    "loFi",
  ],
};

let favorites: Favorites | null = null;
const listeners = new Set<() => void>();

const ids = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];

function read(): Favorites {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "null");
    if (stored === null) return NO_FAVORITES;
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
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
  return next;
}
