import { CHORD_RATES, CHORD_STYLES, STRUM_GAPS } from "../chordStyles";
import { setChordStyle } from "../chordStore";
import { ScreenSeek, ScreenSelection } from "../DeviceScreen";
import { ChordStyleIcon } from "../instrumentIcons";
import { gridLabel } from "../noteRecorder";
import { arrowPads, seekKnob } from "./base";
import type { Mode } from "../../../types/bindings";

// How the chord pads play: the green knob picks a style, the red one its
// pattern's rate and the blue one the strum's gap.
export const chordStyleMode: Mode = (device) => {
  const { performance, transport } = device;
  const { chordStyle, chordStyleIndex, pickChordStyle } = performance;
  const style = CHORD_STYLES[chordStyleIndex];
  const rate = gridLabel({ ...transport.timing, perBeat: chordStyle.perBeat });
  return {
    knobs: {
      green: seekKnob(
        style.name,
        chordStyleIndex,
        CHORD_STYLES.length,
        pickChordStyle,
      ),
      red: {
        label: "Rate",
        valueLabel: rate,
        step: CHORD_RATES.indexOf(chordStyle.perBeat),
        steps: CHORD_RATES.length,
        onChange: (index) => setChordStyle({ perBeat: CHORD_RATES[index] }),
      },
      blue: {
        label: "Strum",
        valueLabel: `${chordStyle.strum} ms`,
        step: STRUM_GAPS.indexOf(chordStyle.strum),
        steps: STRUM_GAPS.length,
        onChange: (index) => setChordStyle({ strum: STRUM_GAPS[index] }),
      },
    },
    pads: arrowPads(
      device,
      ["Previous chord style", "Next chord style"],
      (direction) => pickChordStyle(chordStyleIndex + direction),
    ),
    screen: {
      title: "Chord style",
      status: (
        <ScreenSeek>
          {chordStyleIndex + 1}/{CHORD_STYLES.length}
        </ScreenSeek>
      ),
      // The pattern's rate and the strum's gap in the red and blue of the
      // knobs that set them.
      footer: [
        style.detail,
        <ScreenSelection
          key="style"
          label={`Rate ${rate}`}
          value={`Strum ${chordStyle.strum} ms`}
        />,
      ],
      tiles: CHORD_STYLES.map(({ id, name }) => ({
        id,
        label: name,
        icon: <ChordStyleIcon pattern={id} />,
      })),
      selected: chordStyleIndex,
      onSelect: pickChordStyle,
    },
  };
};
