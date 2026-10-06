export type InstrumentId =
  | "piano"
  | "guitar"
  | "electricGuitar"
  | "nylonGuitar"
  | "bass"
  | "uprightBass"
  | "harp"
  | "violin"
  | "cello"
  | "trumpet"
  | "bassTrumpet"
  | "saxophone"
  | "flute"
  | "clarinet"
  | "trombone"
  | "harmonium"
  | "harmonica"
  | "sitar"
  | "ukulele"
  | "banjo"
  | "xylophone"
  | "steelPan"
  | "kalimba"
  | "oscillator";

export type KitId = "drums" | "drums808" | "madal" | "tabla";

export type DrumPieceId =
  | "kick"
  | "snare"
  | "closedHat"
  | "openHat"
  | "clap"
  | "lowTom"
  | "highTom"
  | "cowbell"
  | "crash"
  // Hand-drum strokes (bols), by syllable; each kit defines its own sounds.
  | "na"
  | "ta"
  | "tin"
  | "tun"
  | "te"
  | "ti"
  | "ge"
  | "ke"
  | "ka"
  | "dha"
  | "dhin";

export type BusId = InstrumentId | KitId;

export type ParamTarget = BusId | "master";

export type EngineEvent =
  | {
      type: "noteOn";
      instrument: InstrumentId;
      note: number;
      velocity: number;
      time?: number;
    }
  | { type: "noteOff"; instrument: InstrumentId; note: number; time?: number }
  | {
      type: "hit";
      kit: KitId;
      piece: DrumPieceId;
      velocity: number;
      time?: number;
    }
  | { type: "sustain"; instrument: InstrumentId; down: boolean; time?: number }
  | { type: "tick"; accent: boolean; time?: number }
  | {
      type: "param";
      target: ParamTarget;
      id: string;
      value: number;
      time?: number;
    }
  | { type: "allNotesOff" }
  | { type: "panic" };

export type EngineStats = {
  activeVoices: number;
  reverbAwake: boolean;
  load?: number;
};

export type WorkletMessage =
  | { type: "ready"; sampleRate: number }
  | ({ type: "stats" } & EngineStats)
  | { type: "warning"; message: string };

export type ProcessorOptions = {
  events?: EngineEvent[];
  overrides?: Partial<Record<ParamTarget, Record<string, number>>>;
};
