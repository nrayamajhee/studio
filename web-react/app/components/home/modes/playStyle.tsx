import { CHORD_RATES, STRUM_GAPS } from "../playStyles";
import {
  deletePlayStyle,
  savePlayStyle,
  setPlayStyle,
  updatePlayStyle,
} from "../chordStore";
import { GAP, ScreenSeek, ScreenValue } from "../DeviceScreen";
import { PlayStyleIcon } from "../instrumentIcons";
import { gridLabel } from "../noteRecorder";
import {
  arrowPads,
  deletePad,
  favoritesPicker,
  idleKnob,
  savePad,
  shelfAt,
  shelfPager,
  shelfStep,
  shelfKnobs,
} from "./base";
import type { KnobBinding, Mode } from "../../../types/bindings";

// How the chord pads play, after the favorites, grouped by what holding a
// chord does, then the saved ones: the red knob (or ← →) picks a page and the
// blue one a play style on it, which plays it. The green knob sets what that
// style listens to, its rate or its strum's gap; for a style that listens to
// both, green is the rate and Shift + green the strum. Save keeps the
// changes, as a new play style or in the saved one picked; Delete removes a
// saved one; Mute stars it.
export const playStyleMode: Mode = (device, base) => {
  const { performance, transport, shift, feedback, browse } = device;
  const { playStyle, playStyleIndex, playStyleEdited, pickPlayStyle } =
    performance;
  const styles = performance.playStyles;
  const {
    listed,
    shelves: groups,
    index: styleIndex,
    chosen: picked,
    select,
    forget,
    mute,
    star,
  } = favoritesPicker(device, {
    kind: "playStyles",
    items: styles,
    categoryOf: ({ group }) => group,
    index: browse.styleIndex,
    setIndex: browse.setStyleIndex,
    picked: styles[playStyleIndex].id,
    onPick: ({ id }) =>
      pickPlayStyle(styles.findIndex((style) => style.id === id)),
  });
  const { shelf: group, at } = shelfAt(groups, styleIndex);
  const rate = gridLabel({ ...transport.timing, perBeat: playStyle.perBeat });
  const strum = `${playStyle.strum} ms`;
  const usesRate = picked.settings.includes("rate");
  const usesStrum = picked.settings.includes("strum");
  const saved = picked.style.saved;

  const rateKnob: KnobBinding = {
    label: "Rate",
    valueLabel: rate,
    step: CHORD_RATES.indexOf(playStyle.perBeat),
    steps: CHORD_RATES.length,
    onChange: (index) => setPlayStyle({ perBeat: CHORD_RATES[index] }),
  };
  const strumKnob: KnobBinding = {
    label: "Strum",
    valueLabel: strum,
    step: STRUM_GAPS.indexOf(playStyle.strum),
    steps: STRUM_GAPS.length,
    onChange: (index) => setPlayStyle({ strum: STRUM_GAPS[index] }),
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
      ...shelfKnobs(groups, styleIndex, picked.name, select),
    },
    pads: {
      save: savePad(device, {
        label: saved ? `Save ${picked.name}` : "Save as a new play style",
        onPress: () => {
          if (!playStyleEdited) {
            feedback.showPrompt(
              picked.settings.length === 0
                ? `${picked.name} has nothing to change`
                : "Change its rate or strum first",
            );
            return;
          }
          if (saved) {
            updatePlayStyle(playStyle);
            feedback.showNotice(`Saved ${picked.name}`);
          } else {
            feedback.showNotice(`Saved ${savePlayStyle(playStyle).name}`);
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
                forget(saved);
                deletePlayStyle(saved);
                feedback.showNotice(`Deleted ${picked.name}`);
              },
            }
          : undefined,
      ),
      mute,
      ...arrowPads(
        device,
        ["Previous group", "Next group"],
        shelfStep(groups, at, select),
      ),
    },
    screen: {
      title: "Play style",
      unsaved: playStyleEdited,
      pager: shelfPager(groups, at, select),
      // What the green knob sets, in green; nothing for a style that has
      // nothing to set.
      footer: [
        <ScreenValue key="style">{picked.name}</ScreenValue>,
        <ScreenSeek key="settings">{settings.join(GAP)}</ScreenSeek>,
      ],
      tiles: listed
        .slice(group.start, group.start + group.count)
        .map((candidate) => ({
          id: candidate.id,
          label: candidate.name,
          icon: <PlayStyleIcon pattern={candidate.style.id} />,
          badge: star(candidate),
        })),
      selected: styleIndex - group.start,
      selectedBy: "blue",
      onSelect: (index) => select(group.start + index),
    },
  };
};
