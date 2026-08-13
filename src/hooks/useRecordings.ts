import { useCallback, useEffect, useState } from "react";
import type { RecordingMeta } from "@/lib/native/types";
import { localRecordingRepository as repo } from "@/lib/store/recordings";

export function useRecordings() {
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);

  const refresh = useCallback(() => setRecordings(repo.list()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("djsr:recordings-changed", handler);
    return () => window.removeEventListener("djsr:recordings-changed", handler);
  }, [refresh]);

  const save = useCallback(
    (recording: RecordingMeta) => {
      repo.upsert({ ...recording, updated_at: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    (id: string) => {
      repo.remove(id);
      refresh();
    },
    [refresh],
  );

  return { recordings, save, remove, refresh };
}
