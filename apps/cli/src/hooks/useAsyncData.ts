import { useState, useEffect } from "react";

interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useAsyncData = <T>(
  fetcher: () => Promise<T>,
  minLoadTime = 350
): AsyncDataState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetcher().catch(err => {
        setError(err.message || "An error occurred");
        return null;
      }),
      pause(minLoadTime)
    ]).then(([result]) => {
      if (result !== null) setData(result);
      setLoading(false);
    });
  }, []);

  return { data, loading, error };
};
