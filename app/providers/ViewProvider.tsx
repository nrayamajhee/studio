import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ScreenView } from "../components/home/DeviceScreen";

interface ViewValue {
  view: ScreenView;
  setView: Dispatch<SetStateAction<ScreenView>>;
  // Where closing a module view goes back to.
  moduleReturn: ScreenView;
  setModuleReturn: Dispatch<SetStateAction<ScreenView>>;
  // A view's own pad opens it, and pressed again goes back to the main screen.
  toggleView: (opens: ScreenView) => void;
  // Revert closes on any press but its own.
  leaveRevert: () => void;
}

const ViewContext = createContext<ViewValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ScreenView>("scope");
  const [moduleReturn, setModuleReturn] = useState<ScreenView>("scope");

  const leaveRevert = () => {
    if (view === "revert") setView("scope");
  };

  const toggleView = (opens: ScreenView) => {
    leaveRevert();
    setView((current) => (current === opens ? "scope" : opens));
  };

  const value: ViewValue = {
    view,
    setView,
    moduleReturn,
    setModuleReturn,
    toggleView,
    leaveRevert,
  };

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) throw new Error("Wrap the Device in a ViewProvider");
  return context;
}
