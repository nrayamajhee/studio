import { createContext, useContext } from "react";

// A context that must be provided: reading it outside its provider throws,
// naming the provider to wrap the Device in.
export function createStrictContext<T>(provider: string) {
  const Context = createContext<T | null>(null);
  const useStrictContext = () => {
    const value = useContext(Context);
    if (value === null) throw new Error(`Wrap the Device in a ${provider}`);
    return value;
  };
  return [Context, useStrictContext] as const;
}
