import { Pad } from "../../design-system";
import { PresetIcon } from "../presetIcons";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { useSound } from "../../../providers/SoundProvider";
import { useView } from "../../../providers/ViewProvider";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function PresetBank() {
  const { view } = useView();
  const { library, preset } = useSound();
  const { padPresets, padName, pressPresetPad } = useDevice();
  const { shiftHotkey } = useHotkeyBadges();

  return (
    <div className={styles.bank} role="group" aria-label="Presets">
      {padPresets.map((padPreset, pad) => {
        const name = padPreset?.name ?? "empty";
        const current = padPreset?.id === preset.id;
        // Lit while either of its two presets plays.
        const sounding =
          library.buttons[pad] === preset.id ||
          library.shiftButtons[pad] === preset.id;
        return (
          <Pad
            key={pad}
            label={
              view === "presets"
                ? `Bind to ${padName(pad).toLowerCase()} (${name})`
                : view === "save"
                  ? `Save to ${padName(pad).toLowerCase()} (${name})`
                  : padPreset
                    ? `${padPreset.name}${current ? " (current)" : ""}`
                    : `Empty preset pad ${pad + 1}`
            }
            accent="var(--synth-red)"
            indicator={padPreset ? sounding : undefined}
            {...shiftHotkey({ kind: "preset", index: pad })}
            onPress={() => pressPresetPad(pad)}
          >
            {padPreset && <PresetIcon icon={padPreset.icon} />}
          </Pad>
        );
      })}
    </div>
  );
}
