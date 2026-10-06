import { useState, type ReactNode } from "react";
import type { ModuleId } from "../components/home/deviceEngine";
import type { ScreenView } from "../components/home/DeviceScreen";
import { createStrictContext } from "./createStrictContext";

export const isModuleView = (view: ScreenView): view is ModuleId =>
  view === "adsr" || view === "lfo" || view === "fx";

function useViewValue(initialView: ScreenView) {
  const [view, setView] = useState<ScreenView>(initialView);
  // Where closing a module view goes back to.
  const [moduleReturn, setModuleReturn] = useState<ScreenView>("scope");

  return {
    view,
    setView,
    activeModule: isModuleView(view) ? view : null,
    // A view's own pad opens it, and pressed again goes back to the main
    // screen.
    toggleView: (opens: ScreenView) =>
      setView((current) => (current === opens ? "scope" : opens)),
    // Revert closes on any press but its own (Delete, Shift, the arrows and
    // knobs), so it never traps anyone; the press then does what it does.
    leaveRevert: () => {
      if (view === "revert") setView("scope");
    },
    // A module pad opens its view, and pressed again goes back to the view
    // it was opened from (moving between modules keeps that).
    toggleModule: (id: ModuleId) => {
      if (view === id) {
        setView(moduleReturn);
        return;
      }
      if (!isModuleView(view))
        setModuleReturn(view === "revert" ? "scope" : view);
      setView(id);
    },
  };
}

export type ViewValue = ReturnType<typeof useViewValue>;

const [ViewContext, useView] = createStrictContext<ViewValue>("ViewProvider");
export { useView };

// Which view the Device's screen shows.
export function ViewProvider({
  initialView = "scope",
  children,
}: {
  initialView?: ScreenView;
  children: ReactNode;
}) {
  return (
    <ViewContext value={useViewValue(initialView)}>{children}</ViewContext>
  );
}
