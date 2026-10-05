import type { ReactNode } from "react";
import { Pad } from "../../design-system";
import { DEVICE_MODULES, type ModuleId } from "../deviceEngine";
import { useModules } from "../../../providers/ModuleProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useView } from "../../../providers/ViewProvider";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function ModulePad({
  id,
  icon,
}: {
  id: ModuleId;
  icon: ReactNode;
}) {
  const module = DEVICE_MODULES[id];
  const { moduleOn, pressModule } = useModules();
  const { shift } = usePerformance();
  const { view } = useView();
  const { shiftHotkey } = useHotkeyBadges();
  return (
    <Pad
      label={
        shift
          ? `Turn ${module.label} ${moduleOn[id] ? "off" : "on"}`
          : `${module.title} (${moduleOn[id] ? "on" : "off"})`
      }
      accent="var(--synth-red)"
      lit={view === id}
      indicator={moduleOn[id]}
      {...shiftHotkey({ kind: "tool", tool: id })}
      onPress={() => pressModule(id)}
    >
      {icon}
    </Pad>
  );
}
