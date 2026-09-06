import { useLocalStorage } from "usehooks-ts";
import { type SynthParams, synth } from "./synth";
import { type MockUser } from "./mockUser";
import { type ScaleType } from "../components/piano-roll/types";

export const STUDIO_STORAGE_KEY = "studio_state";

export interface StudioState {
  user: MockUser | null;
  notes: string[];
  disabledNotes: string[];
  noteVelocities: Record<string, number>;
  rootKey: string;
  scale: ScaleType;
  bpm: number;
  totalSteps: number;
  volume: number;
  isLooping: boolean;
  selectedPreset: string;
  jumpOctave: number;
  velocity: number;
  playerView: "keys" | "drums";
  synthParams: SynthParams;
}

export const DEFAULT_STUDIO_STATE: StudioState = {
  user: null,
  notes: [
    "C4-0",
    "E4-2",
    "G4-4",
    "B4-6",
    "C5-8",
    "G4-10",
    "E4-12",
    "C4-14",
  ],
  disabledNotes: [],
  noteVelocities: {
    "C4-0": 95,
    "E4-2": 80,
    "G4-4": 88,
    "B4-6": 75,
    "C5-8": 100,
    "G4-10": 82,
    "E4-12": 70,
    "C4-14": 85,
  },
  rootKey: "C",
  scale: "major",
  bpm: 72,
  totalSteps: 16,
  volume: 0.7,
  isLooping: true,
  selectedPreset: "grand_piano",
  jumpOctave: 4,
  velocity: 85,
  playerView: "keys",
  synthParams: { ...synth.params },
};

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
    }
    LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch (_e) {
    // Storage access fallback
  }
}

export function useStudioStorage() {
  return useLocalStorage<StudioState>(STUDIO_STORAGE_KEY, DEFAULT_STUDIO_STATE);
}
