import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { ScreenReadout } from "../components/home/DeviceScreen";
import {
  DEVICE_MODULES,
  type ModuleId,
} from "../components/home/deviceEngine";
import {
  applyModules,
  knobDisplay,
  knobValue,
  type ModuleSettings,
} from "../components/home/modules";
import { setTakeModules, useSession } from "../components/home/sessionStore";
import { modulesChange, trackModules } from "../components/home/tracks";
import { usePerformance } from "./PerformanceProvider";
import { useTracks, TAKE_ID } from "./TracksProvider";
import { useView } from "./ViewProvider";

interface ModuleValue {
  modules: ModuleSettings;
  moduleOn: ModuleSettings["on"];
  moduleSteps: ModuleSettings["steps"];
  modulesKey: string;
  modulesOwner: string;
  activeModule: ModuleId | null;
  readouts: readonly ScreenReadout[];
  setModules: (next: ModuleSettings) => void;
  setModuleStep: (id: ModuleId, index: number, step: number) => void;
  pressModule: (id: ModuleId) => void;
}

const ModuleContext = createContext<ModuleValue | null>(null);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { view, moduleReturn, setModuleReturn, setView, leaveRevert } =
    useView();
  const { shift } = usePerformance();
  const { pickedEntry, updateTrack } = useTracks();
  const { modules: takeModules } = useSession();

  // The picked row's ADSR, LFO and FX, the tape's or a track's own.
  const modules =
    pickedEntry.id === TAKE_ID ? takeModules : trackModules(pickedEntry);
  const { on: moduleOn, steps: moduleSteps } = modules;
  const modulesKey = JSON.stringify(modules);
  const modulesOwner = pickedEntry.id === TAKE_ID ? "Tape" : pickedEntry.name;

  const setModules = (next: ModuleSettings) => {
    if (pickedEntry.id === TAKE_ID) setTakeModules(next);
    else updateTrack(pickedEntry.id, modulesChange(pickedEntry, next));
  };

  useEffect(() => applyModules(JSON.parse(modulesKey)), [modulesKey]);

  // Turning a module's knob switches the module on so the change is audible.
  const setModuleStep = (id: ModuleId, index: number, step: number) =>
    setModules({
      on: { ...moduleOn, [id]: true },
      steps: {
        ...moduleSteps,
        [id]: moduleSteps[id].map((value, i) => (i === index ? step : value)),
      },
    });

  // A module pad opens its view, and pressed again goes back to the view it
  // was opened from; with Shift it switches the module on or off.
  const pressModule = (id: ModuleId) => {
    leaveRevert();
    if (shift) {
      setModules({ ...modules, on: { ...moduleOn, [id]: !moduleOn[id] } });
      return;
    }
    if (view === id) {
      setView(moduleReturn);
      return;
    }
    if (view !== "adsr" && view !== "lfo" && view !== "fx")
      setModuleReturn(view === "revert" ? "scope" : view);
    setView(id);
  };

  const activeModule: ModuleId | null =
    view === "adsr" || view === "lfo" || view === "fx" ? view : null;
  const readouts: ScreenReadout[] = activeModule
    ? DEVICE_MODULES[activeModule].knobs.map((knob, i) => {
        const step = moduleSteps[activeModule][i];
        const value = knobValue(knob, step);
        return {
          label: knob.spec.label,
          display: knobDisplay(knob, step),
          amount:
            knob.spec.id === "adsr.sustain" ? value : step / (knob.steps - 1),
        };
      })
    : [];

  const value: ModuleValue = {
    modules,
    moduleOn,
    moduleSteps,
    modulesKey,
    modulesOwner,
    activeModule,
    readouts,
    setModules,
    setModuleStep,
    pressModule,
  };

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (!context) throw new Error("Wrap the Device in a ModuleProvider");
  return context;
}
