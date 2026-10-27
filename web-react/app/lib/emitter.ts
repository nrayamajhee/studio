export type Emitter<T> = {
  subscribe: (listener: (value: T) => void) => () => void;
  emit: (value: T) => void;
};

// Listeners told about each value as it happens. Made once per provider
// (`useState(() => createEmitter())`), its `subscribe` keeps one identity, so
// effects subscribing with it run once.
export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (value) => {
      for (const listener of listeners) listener(value);
    },
  };
}
