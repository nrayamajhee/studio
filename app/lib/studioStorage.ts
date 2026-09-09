import { useLocalStorage } from "usehooks-ts";
import { type SynthParams, SYNTH_PRESETS, synth } from "./synth";
import { type MockUser } from "./mockUser";
import { type ScaleType } from "../components/piano-roll/types";

export const STUDIO_STORAGE_KEY = "studio_state";

export interface Track {
  id: string;
  name: string;
  color: string;
  preset: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  notes: string[];
  disabledNotes: string[];
  noteVelocities: Record<string, number>;
  totalSteps: number;
  timeSignature?: "4/4" | "3/4" | "triplet";
  rootKey: string;
  scale: ScaleType;
  playerView: "keys" | "drums";
  synthParams: SynthParams;
  clipCount: number;
  startMeasure?: number;
}

export interface Song {
  id: string;
  name: string;
  bpm: number;
  timeSignature: "4/4" | "3/4" | "triplet";
  tracks: Track[];
  activeTrackId: string;
}

export const TRACK_COLORS = [
  "#f97316",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#ec4899",
  "#eab308",
  "#06b6d4",
  "#f43f5e",
];

export const DEFAULT_TRACKS: Track[] = [
  {
    id: "track-1",
    name: "01 Drum Machine",
    color: "#f97316",
    preset: "drum_set",
    volume: 0.85,
    isMuted: false,
    isSolo: false,
    notes: [
      "C1-0",
      "C1-8",
      "C1-10",
      "D1-4",
      "D1-12",
      "G1-0",
      "G1-2",
      "G1-4",
      "G1-6",
      "G1-8",
      "G1-10",
      "G1-12",
      "G1-14",
      "C#2-0",
    ],
    disabledNotes: [],
    noteVelocities: {
      "C1-0": 100,
      "C1-8": 95,
      "C1-10": 90,
      "D1-4": 95,
      "D1-12": 95,
      "G1-0": 75,
      "G1-2": 70,
      "G1-4": 75,
      "G1-6": 70,
      "G1-8": 75,
      "G1-10": 70,
      "G1-12": 75,
      "G1-14": 70,
      "C#2-0": 85,
    },
    totalSteps: 16,
    timeSignature: "4/4",
    rootKey: "C",
    scale: "major",
    playerView: "drums",
    synthParams: { ...SYNTH_PRESETS.drum_set },
    clipCount: 4,
    startMeasure: 0,
  },
  {
    id: "track-2",
    name: "02 Piano",
    color: "#3b82f6",
    preset: "grand_piano",
    volume: 0.8,
    isMuted: false,
    isSolo: false,
    notes: [
      "A2-0",
      "A3-0",
      "C4-0",
      "E4-0",
      "F2-4",
      "F3-4",
      "A3-4",
      "C4-4",
      "C3-8",
      "C4-8",
      "E4-8",
      "G4-8",
      "G2-12",
      "G3-12",
      "B3-12",
      "D4-12",
    ],
    disabledNotes: [],
    noteVelocities: {
      "A2-0": 90,
      "A3-0": 85,
      "C4-0": 95,
      "E4-0": 90,
      "F2-4": 90,
      "F3-4": 85,
      "A3-4": 95,
      "C4-4": 90,
      "C3-8": 90,
      "C4-8": 85,
      "E4-8": 95,
      "G4-8": 90,
      "G2-12": 90,
      "G3-12": 85,
      "B3-12": 95,
      "D4-12": 90,
    },
    totalSteps: 16,
    timeSignature: "4/4",
    rootKey: "C",
    scale: "major",
    playerView: "keys",
    synthParams: { ...SYNTH_PRESETS.grand_piano },
    clipCount: 4,
    startMeasure: 0,
  },
];

export const DEFAULT_SONG: Song = {
  id: "song-1",
  name: "Untitled Project",
  bpm: 72,
  timeSignature: "4/4",
  tracks: DEFAULT_TRACKS,
  activeTrackId: "track-2",
};

export interface StudioState {
  user: MockUser | null;
  song: Song;
  notes: string[];
  disabledNotes: string[];
  noteVelocities: Record<string, number>;
  rootKey: string;
  scale: ScaleType;
  bpm: number;
  totalSteps: number;
  timeSignature?: "4/4" | "3/4" | "triplet";
  volume: number;
  isLooping: boolean;
  isMetronomeOn?: boolean;
  selectedPreset: string;
  jumpOctave: number;
  velocity: number;
  playerView: "keys" | "drums";
  synthParams: SynthParams;
}

export const DEFAULT_STUDIO_STATE: StudioState = {
  user: null,
  song: DEFAULT_SONG,
  notes: DEFAULT_TRACKS[1].notes,
  disabledNotes: DEFAULT_TRACKS[1].disabledNotes,
  noteVelocities: DEFAULT_TRACKS[1].noteVelocities,
  rootKey: "C",
  scale: "major",
  bpm: 72,
  totalSteps: 16,
  timeSignature: "4/4",
  volume: 0.7,
  isLooping: true,
  isMetronomeOn: false,
  selectedPreset: "grand_piano",
  jumpOctave: 4,
  velocity: 85,
  playerView: "keys",
  synthParams: { ...SYNTH_PRESETS.grand_piano },
};

export function getActiveTrack(state: StudioState): Track {
  const found = state.song?.tracks?.find(
    (t) => t.id === state.song.activeTrackId,
  );
  return found || state.song?.tracks?.[0] || DEFAULT_TRACKS[0];
}

export function setActiveTrack(
  state: StudioState,
  trackId: string,
): StudioState {
  const track = state.song.tracks.find((t) => t.id === trackId);
  if (!track) return state;

  return {
    ...state,
    song: {
      ...state.song,
      activeTrackId: trackId,
    },
    notes: [...track.notes],
    disabledNotes: [...track.disabledNotes],
    noteVelocities: { ...track.noteVelocities },
    totalSteps: track.totalSteps,
    timeSignature: track.timeSignature ?? state.song.timeSignature,
    rootKey: track.rootKey,
    scale: track.scale,
    selectedPreset: track.preset,
    playerView: track.playerView,
    synthParams: { ...track.synthParams },
  };
}

export function updateActiveTrack(
  state: StudioState,
  updates: Partial<Track>,
): StudioState {
  const activeId = state.song.activeTrackId;
  const nextTracks = state.song.tracks.map((t) => {
    if (t.id !== activeId) return t;
    return {
      ...t,
      ...updates,
    };
  });

  return {
    ...state,
    song: {
      ...state.song,
      tracks: nextTracks,
    },
    ...(updates.notes !== undefined && { notes: updates.notes }),
    ...(updates.disabledNotes !== undefined && {
      disabledNotes: updates.disabledNotes,
    }),
    ...(updates.noteVelocities !== undefined && {
      noteVelocities: updates.noteVelocities,
    }),
    ...(updates.totalSteps !== undefined && {
      totalSteps: updates.totalSteps,
    }),
    ...(updates.timeSignature !== undefined && {
      timeSignature: updates.timeSignature,
    }),
    ...(updates.rootKey !== undefined && { rootKey: updates.rootKey }),
    ...(updates.scale !== undefined && { scale: updates.scale }),
    ...(updates.preset !== undefined && { selectedPreset: updates.preset }),
    ...(updates.playerView !== undefined && {
      playerView: updates.playerView,
    }),
    ...(updates.synthParams !== undefined && {
      synthParams: updates.synthParams,
    }),
  };
}

export function updateTrack(
  state: StudioState,
  trackId: string,
  updates: Partial<Track>,
): StudioState {
  const nextTracks = state.song.tracks.map((t) =>
    t.id === trackId ? { ...t, ...updates } : t,
  );

  const isCurrentActive = state.song.activeTrackId === trackId;

  return {
    ...state,
    song: {
      ...state.song,
      tracks: nextTracks,
    },
    ...(isCurrentActive && {
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.disabledNotes !== undefined && {
        disabledNotes: updates.disabledNotes,
      }),
      ...(updates.noteVelocities !== undefined && {
        noteVelocities: updates.noteVelocities,
      }),
      ...(updates.totalSteps !== undefined && {
        totalSteps: updates.totalSteps,
      }),
      ...(updates.timeSignature !== undefined && {
        timeSignature: updates.timeSignature,
      }),
      ...(updates.preset !== undefined && { selectedPreset: updates.preset }),
      ...(updates.playerView !== undefined && {
        playerView: updates.playerView,
      }),
      ...(updates.synthParams !== undefined && {
        synthParams: updates.synthParams,
      }),
    }),
  };
}

export function addTrack(
  state: StudioState,
  newTrackProps: Partial<Track>,
): StudioState {
  const nextNum = state.song.tracks.length + 1;
  const numStr = nextNum.toString().padStart(2, "0");
  const trackId = `track-${Date.now()}`;
  const isDrum = newTrackProps.preset?.includes("drum");

  const newTrack: Track = {
    id: trackId,
    name:
      newTrackProps.name ||
      `${numStr} ${isDrum ? "Drum Machine" : "Instrument"}`,
    color:
      newTrackProps.color ||
      TRACK_COLORS[(nextNum - 1) % TRACK_COLORS.length],
    preset: newTrackProps.preset || (isDrum ? "drum_set" : "grand_piano"),
    volume: newTrackProps.volume ?? 0.8,
    isMuted: false,
    isSolo: false,
    notes:
      newTrackProps.notes ||
      (isDrum
        ? ["C1-0", "C1-4", "C1-8", "C1-12"]
        : ["C4-0", "E4-4", "G4-8", "C5-12"]),
    disabledNotes: [],
    noteVelocities: {
      "C4-0": 90,
      "E4-4": 85,
      "G4-8": 90,
      "C5-12": 85,
    },
    totalSteps: 16,
    timeSignature: state.song.timeSignature || "4/4",
    rootKey: state.rootKey || "C",
    scale: state.scale || "major",
    playerView: isDrum ? "drums" : "keys",
    synthParams: { ...synth.params },
    clipCount: newTrackProps.clipCount || 4,
    startMeasure: newTrackProps.startMeasure ?? 0,
  };

  return {
    ...state,
    song: {
      ...state.song,
      tracks: [...state.song.tracks, newTrack],
    },
  };
}

export function deleteTrack(
  state: StudioState,
  trackId: string,
): StudioState {
  if (state.song.tracks.length <= 1) return state;
  const nextTracks = state.song.tracks.filter((t) => t.id !== trackId);
  const nextActiveId =
    state.song.activeTrackId === trackId
      ? nextTracks[0].id
      : state.song.activeTrackId;

  return setActiveTrack(
    {
      ...state,
      song: {
        ...state.song,
        tracks: nextTracks,
        activeTrackId: nextActiveId,
      },
    },
    nextActiveId,
  );
}

const LEGACY_KEYS = [
  "studio_mock_user",
  "studio_piano_roll_notes",
  "studio_piano_roll_disabled_notes",
  "studio_piano_roll_velocities",
  "studio_is_looping",
  "studio_master_volume",
  "studio_total_steps",
  "studio_tempo_bpm",
  "studio_selected_preset",
  "studio_jump_octave",
  "studio_player_view",
  "studio_default_velocity",
  "studio_synth_params",
  "studio_piano_roll_root_key",
  "studio_piano_roll_scale",
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (_e) {
    return fallback;
  }
}

if (typeof window !== "undefined") {
  try {
    const existing = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!existing) {
      const hasLegacy = LEGACY_KEYS.some(
        (k) => window.localStorage.getItem(k) !== null,
      );
      if (hasLegacy) {
        const migrated: StudioState = {
          user: safeParse(window.localStorage.getItem("studio_mock_user"), DEFAULT_STUDIO_STATE.user),
          song: DEFAULT_SONG,
          notes: safeParse(window.localStorage.getItem("studio_piano_roll_notes"), DEFAULT_STUDIO_STATE.notes),
          disabledNotes: safeParse(window.localStorage.getItem("studio_piano_roll_disabled_notes"), DEFAULT_STUDIO_STATE.disabledNotes),
          noteVelocities: safeParse(window.localStorage.getItem("studio_piano_roll_velocities"), DEFAULT_STUDIO_STATE.noteVelocities),
          rootKey: safeParse(window.localStorage.getItem("studio_piano_roll_root_key"), DEFAULT_STUDIO_STATE.rootKey),
          scale: safeParse(window.localStorage.getItem("studio_piano_roll_scale"), DEFAULT_STUDIO_STATE.scale),
          bpm: safeParse(window.localStorage.getItem("studio_tempo_bpm"), DEFAULT_STUDIO_STATE.bpm),
          totalSteps: safeParse(window.localStorage.getItem("studio_total_steps"), DEFAULT_STUDIO_STATE.totalSteps),
          volume: safeParse(window.localStorage.getItem("studio_master_volume"), DEFAULT_STUDIO_STATE.volume),
          isLooping: safeParse(window.localStorage.getItem("studio_is_looping"), DEFAULT_STUDIO_STATE.isLooping),
          selectedPreset: safeParse(window.localStorage.getItem("studio_selected_preset"), DEFAULT_STUDIO_STATE.selectedPreset),
          jumpOctave: safeParse(window.localStorage.getItem("studio_jump_octave"), DEFAULT_STUDIO_STATE.jumpOctave),
          playerView: safeParse(window.localStorage.getItem("studio_player_view"), DEFAULT_STUDIO_STATE.playerView),
          velocity: safeParse(window.localStorage.getItem("studio_default_velocity"), DEFAULT_STUDIO_STATE.velocity),
          synthParams: safeParse(window.localStorage.getItem("studio_synth_params"), DEFAULT_STUDIO_STATE.synthParams),
        };
        window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(migrated));
      }
    } else {
      const parsed = safeParse<Partial<StudioState>>(existing, {});
      const hasOldTracks =
        !parsed.song ||
        !Array.isArray(parsed.song.tracks) ||
        parsed.song.tracks.length === 0 ||
        parsed.song.tracks[0]?.clipCount === 12 ||
        parsed.song.tracks[1]?.clipCount === 3;

      if (hasOldTracks) {
        const upgraded: StudioState = {
          ...DEFAULT_STUDIO_STATE,
          ...parsed,
          song: DEFAULT_SONG,
          notes: DEFAULT_TRACKS[1].notes,
          disabledNotes: DEFAULT_TRACKS[1].disabledNotes,
          noteVelocities: DEFAULT_TRACKS[1].noteVelocities,
          selectedPreset: DEFAULT_TRACKS[1].preset,
          playerView: DEFAULT_TRACKS[1].playerView,
          synthParams: { ...DEFAULT_TRACKS[1].synthParams },
        };
        window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(upgraded));
      }
    }
    LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch (_e) {
    // Storage access fallback
  }
}

export function useStudioStorage() {
  return useLocalStorage<StudioState>(STUDIO_STORAGE_KEY, DEFAULT_STUDIO_STATE);
}
