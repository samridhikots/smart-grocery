import { useState } from "react";

type SetValue<T> = (val: T | ((prev: T) => T)) => void;

export function useLocalStorage<T>(key: string, initial: T): [T, SetValue<T>] {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initial;
    } catch {
      return initial;
    }
  });

  const setValue: SetValue<T> = (val) => {
    try {
      const next = val instanceof Function ? val(stored) : val;
      setStored(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore write errors (private browsing, storage full)
    }
  };

  return [stored, setValue];
}
