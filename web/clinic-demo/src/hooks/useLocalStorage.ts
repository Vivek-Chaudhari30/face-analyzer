import { useCallback, useEffect, useState } from "react";

/** useState persisted to localStorage. Silently falls back to memory if storage is blocked. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, [key, value]);

  const clear = useCallback(() => {
    setValue(initial);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, clear] as const;
}
