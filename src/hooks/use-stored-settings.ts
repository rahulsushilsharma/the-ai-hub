import { useCallback, useState } from "react";

type Values = Record<string, string | number | boolean>;

/** Settings object persisted to localStorage under `key`; unknown/missing keys fall back to `defaults`. */
export function useStoredSettings<T extends Values>(key: string, defaults: T) {
  const [values, setValues] = useState<T>(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
    } catch {
      return defaults;
    }
  });
  const set = useCallback(
    (patch: Partial<T>) =>
      setValues((v) => {
        const next = { ...v, ...patch };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage blocked */
        }
        return next;
      }),
    [key]
  );
  const reset = useCallback(() => set(defaults), [set, defaults]);
  return [values, set, reset] as const;
}
