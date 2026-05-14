import { useState, useCallback, useRef, useEffect, DependencyList } from "react";

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  refresh: () => void;
}

/**
 * Generic data-fetching hook with stale-check race-condition prevention.
 * Pass a stable fetcher (wrapped in useCallback) and optional deps to re-run on.
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = []
): UseFetchResult<T> {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);
  const idRef      = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const id = ++idRef.current;
    setLoading(true);
    setError("");
    fetcherRef.current().then(
      (result) => {
        if (id === idRef.current) { setData(result); setLoading(false); }
      },
      (e: unknown) => {
        if (id === idRef.current) {
          setError(e instanceof Error ? e.message : "Something went wrong");
          setLoading(false);
        }
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refresh };
}
