import { Disc3 } from "lucide-react";
import type { ScreenTile } from "../DeviceScreen";
import { CHORD_PALETTE } from "../chords";
import { CHORD_STYLES } from "../chordStyles";
import { ChordStyleIcon } from "../instrumentIcons";
import { ICON_CHOICES, PresetIcon, iconLabel } from "../presetIcons";
import { useSession } from "../sessionStore";
import { useDevice } from "../../../providers/DeviceProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useSound } from "../../../providers/SoundProvider";
import { useTracks } from "../../../providers/TracksProvider";
import { useView } from "../../../providers/ViewProvider";

// The tiles the screen shows for the current view, and which is picked.
export function useScreenTiles(): {
  tiles: readonly ScreenTile[] | undefined;
  selected: number;
  onSelect: (index: number) => void;
} {
  const { view } = useView();
  const {
    library,
    presets,
    presetIndex,
    iconIndex,
    revertIndex,
    setPresetIndex,
    setIconIndex,
    setRevertIndex,
  } = useSound();
  const { chordIndex, chordStyleIndex, setChordIndex, pickChordStyle } =
    usePerformance();
  const { selectedIndex, setSelectedIndex } = useTracks();
  const { songs, song } = useSession();
  const { revertOptions, pickSong } = useDevice();
  const songIndex = Math.max(
    0,
    songs.findIndex(({ id }) => id === song),
  );

  const tiles: readonly ScreenTile[] | undefined =
    view === "save"
      ? ICON_CHOICES.map((icon) => ({
          id: icon,
          label: iconLabel(icon),
          icon: <PresetIcon icon={icon} />,
        }))
      : view === "album"
        ? songs.map(({ id, name }) => ({
            id,
            label: name,
            icon: <Disc3 />,
          }))
        : view === "chordStyle"
          ? CHORD_STYLES.map(({ id, name }) => ({
              id,
              label: name,
              icon: <ChordStyleIcon pattern={id} />,
            }))
          : view === "revert"
            ? revertOptions.map(({ id, label, icon }) => ({ id, label, icon }))
            : view === "chords"
              ? CHORD_PALETTE.map((chord) => ({
                  id: chord.id,
                  label: chord.name,
                  icon: <span>{chord.label}</span>,
                }))
              : presets.map((candidate) => {
                  const bound = [
                    ...library.buttons.map((id, pad) =>
                      id === candidate.id ? `${pad + 1}` : "",
                    ),
                    ...library.shiftButtons.map((id, pad) =>
                      id === candidate.id ? `⇧${pad + 1}` : "",
                    ),
                  ].filter(Boolean);
                  return {
                    id: candidate.id,
                    label: candidate.name,
                    icon: <PresetIcon icon={candidate.icon} />,
                    badge: bound.length > 0 ? bound.join(" ") : undefined,
                  };
                });

  const selected =
    view === "save"
      ? iconIndex
      : view === "album"
        ? songIndex
        : view === "chordStyle"
          ? chordStyleIndex
          : view === "revert"
            ? revertIndex
            : view === "tracks"
              ? selectedIndex
              : view === "chords"
                ? chordIndex
                : presetIndex;

  const onSelect = (index: number) => {
    if (view === "save") setIconIndex(index);
    else if (view === "album") pickSong(index);
    else if (view === "chordStyle") pickChordStyle(index);
    else if (view === "revert") setRevertIndex(index);
    else if (view === "tracks") setSelectedIndex(index);
    else if (view === "chords") setChordIndex(index);
    else setPresetIndex(index);
  };

  return { tiles, selected, onSelect };
}
