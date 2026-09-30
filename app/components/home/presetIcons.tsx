import type { ComponentType } from "react";
import {
  AudioWaveform,
  Bell,
  CassetteTape,
  Cloud,
  Disc3,
  Drum,
  Flame,
  Gem,
  Ghost,
  Guitar,
  Headphones,
  Heart,
  KeyboardMusic,
  Leaf,
  Mic,
  Moon,
  Music,
  Music2,
  Piano,
  Radio,
  Rocket,
  Snowflake,
  Sparkles,
  Speaker,
  Star,
  Sun,
  Volume2,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { UprightBassIcon, ViolinIcon } from "./instrumentIcons";

export const PRESET_ICONS: Record<string, ComponentType> = {
  piano: Piano,
  guitar: Guitar,
  bass: Zap,
  drum: Drum,
  wind: Wind,
  sax: Volume2,
  violin: ViolinIcon,
  upright: UprightBassIcon,
  keys: KeyboardMusic,
  waveform: AudioWaveform,
  waves: Waves,
  music: Music,
  notes: Music2,
  mic: Mic,
  bell: Bell,
  disc: Disc3,
  headphones: Headphones,
  radio: Radio,
  speaker: Speaker,
  cassette: CassetteTape,
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  flame: Flame,
  snowflake: Snowflake,
  moon: Moon,
  ghost: Ghost,
  rocket: Rocket,
  sun: Sun,
  cloud: Cloud,
  leaf: Leaf,
  gem: Gem,
};

// Offered by the Save picker, two full pages of 16: instruments and sound on
// the first, gear and moods on the second.
export const ICON_CHOICES = Object.keys(PRESET_ICONS);

// A preset's icon, or the key itself as text when it isn't a known icon.
export function PresetIcon({ icon }: { icon: string }) {
  const Icon = PRESET_ICONS[icon];
  return Icon ? <Icon /> : <>{icon}</>;
}
