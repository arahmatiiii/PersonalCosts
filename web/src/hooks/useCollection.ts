import { onSnapshot, type Query } from "firebase/firestore";
import { useEffect, useState } from "react";

export interface LiveResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  /** true while the data comes only from the offline cache */
  fromCache: boolean;
}

/** Subscribes to a Firestore query. `key` must change whenever the query changes. */
export function useLiveQuery<T>(query: Query | null, key: string): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: [], loading: true, error: null, fromCache: false });

  useEffect(() => {
    if (!query) return;
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      query,
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
