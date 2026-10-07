import { CHORD_RATES, STRUM_GAPS } from "../chordStyles";
import {
  deleteChordStyle,
  saveChordStyle,
  setChordStyle,
  updateChordStyle,
} from "../chordStore";
import { ScreenLevel, ScreenSeek, ScreenValue } from "../DeviceScreen";
import { ChordStyleIcon } from "../instrumentIcons";
import { gridLabel } from "../noteRecorder";
import {
  arrowPads,
  deletePad,
  idleKnob,
  savePad,
  shelfAt,
  shelfKnobs,
  shelvesOf,
} from "./base";
import type { KnobBinding, Mode } from "../../../types/bindings";

// How the chord pads play, grouped by what holding a chord does, then the
// saved ones: the red knob (or ← →) picks a group and the blue one a play
// style in it. The green knob sets what that style listens to, its rate or
// its strum's gap; for a style that listens to both, green is the rate and
// Shift + green the strum. Save keeps the changes, as a new play style or in
// the saved one picked; Delete removes a saved one.
export const chordStyleMode: Mode = (device, base) => {
  const { performance, transport, shift, feedback } = device;
  const { chordStyle, chordStyleIndex, chordStyleEdited, pickChordStyle } =
    performance;
  const styles = performance.playStyles;
  const groups = shelvesOf(styles, ({ group }) => group);
  const picked = styles[chordStyleIndex];
  const { shelf: group, at } = shelfAt(groups, chordStyleIndex);
  const rate = gridLabel({ ...transport.timing, perBeat: chordStyle.perBeat });
  const strum = `${chordStyle.strum} ms`;
  const usesRate = picked.settings.includes("rate");
  const usesStrum = picked.settings.includes("strum");
  const saved = picked.style.saved;

  const rateKnob: KnobBinding = {
    label: "Rate",
    valueLabel: rate,
    step: CHORD_RATES.indexOf(chordStyle.perBeat),
    steps: CHORD_RATES.length,
    onChange: (index) => setChordStyle({ perBeat: CHORD_RATES[index] }),
  };
  const strumKnob: KnobBinding = {
    label: "Strum",
    valueLabel: strum,
    step: STRUM_GAPS.indexOf(chordStyle.strum),
    steps: STRUM_GAPS.length,
    onChange: (index) => setChordStyle({ strum: STRUM_GAPS[index] }),
  };
  const green =
    usesStrum && (shift || !usesRate)
      ? strumKnob
      : usesRate
        ? rateKnob
        : idleKnob(base.knobs.green);
  const settings = [
    usesRate && `Rate ${rate}`,
    usesStrum && `${usesRate ? "⇧ " : ""}Strum ${strum}`,
  ].filter(Boolean);

  return {
    knobs: {
      green,
      ...shelfKnobs(groups, chordStyleIndex, picked.name, pickChordStyle),
    },
    pads: {
      save: savePad(device, {
        label: saved ? `Save ${picked.name}` : "Save as a new play style",
        onPress: () => {
          if (!chordStyleEdited) {
            feedback.showPrompt(
              picked.settings.length === 0
                ? `${picked.name} has nothing to change`
                : "Change its rate or strum first",
            );
            return;
          }
          if (saved) {
            updateChordStyle(chordStyle);
            feedback.showNotice(`Saved ${picked.name}`);
          } else {
            feedback.showNotice(`Saved ${saveChordStyle(chordStyle).name}`);
          }
        },
      }),
      delete: deletePad(
        device,
        saved
          ? {
              label: `Delete ${picked.name}`,
              key: `delete:${saved}`,
              prompt: `Press again to delete ${picked.name}`,
              run: () => {
                deleteChordStyle(saved);
                feedback.showNotice(`Deleted ${picked.name}`);
              },
            }
          : undefined,
      ),
      ...arrowPads(device, ["Previous group", "Next group"], (direction) =>
        pickChordStyle(
          groups[Math.max(0, Math.min(groups.length - 1, at + direction))]
            .start,
        ),
      ),
    },
    screen: {
      title: "Play style",
      unsaved: chordStyleEdited,
      status: (
        <ScreenLevel>
          {group.name} {at + 1}/{groups.length}
        </ScreenLevel>
      ),
      // What the green knob sets, in green; nothing for a style that has
      // nothing to set.
      footer: [
        <ScreenValue key="style">{picked.name}</ScreenValue>,
        <ScreenSeek key="settings">{settings.join(" · ")}</ScreenSeek>,
      ],
      tiles: styles
        .slice(group.start, group.start + group.count)
        .map(({ id, name, style }) => ({
          id,
          label: name,
          icon: <ChordStyleIcon pattern={style.id} />,
        })),
      selected: chordStyleIndex - group.start,
      selectedBy: "blue",
      onSelect: (index) => pickChordStyle(group.start + index),
    },
  };
};
