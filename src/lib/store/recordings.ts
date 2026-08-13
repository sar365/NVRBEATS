/**
 * RecordingRepository — local-first metadata store.
 *
 * The shape mirrors the local SQLite `recordings` table used by the native
 * Windows build. In the browser preview we persist to localStorage; in the
 * desktop build this interface is backed by SQLite through Tauri commands
 * (`db_list_recordings`, `db_upsert_recording`, `db_delete_recording`).
 * No cloud database, no accounts.
 */
import type { RecordingMeta } from "@/lib/native/types";

export interface RecordingRepository {
  list(): RecordingMeta[];
  get(id: string): RecordingMeta | undefined;
  upsert(recording: RecordingMeta): void;
  remove(id: string): void;
}

const KEY = "djsr.recordings.v1";

function seed(): RecordingMeta[] {
  const mk = (
    id: string,
    set_name: string,
    date: string,
    duration: number,
    format: RecordingMeta["format"],
    genre: string,
    location: string,
    file_size: number,
  ): RecordingMeta => ({
    id,
    filename: `DJ Set - ${date} - 21-30-00.${format.toLowerCase()}`,
    filepath: `C:\\Users\\DJ\\Music\\DJ Sets\\DJ Set - ${date} - 21-30-00.${format.toLowerCase()}`,
    artist: "Sarina",
    set_name,
    date,
    duration,
    format,
    sample_rate: 48000,
    bit_depth: 24,
    file_size,
    genre,
    location,
    notes: "",
    tags: [genre.toLowerCase()],
    artwork_path: null,
    created_at: new Date(date).toISOString(),
    updated_at: new Date(date).toISOString(),
  });

  return [
    mk("r1", "Basement Warmup", "2026-08-09", 3742, "WAV", "House", "Home Studio", 1_077_696_000),
    mk("r2", "Peak Time Rollout", "2026-07-28", 7215, "WAV", "Techno", "The Vault", 2_077_920_000),
    mk("r3", "Sunday Selects", "2026-07-14", 5401, "FLAC", "Disco", "Home Studio", 892_000_000),
    mk("r4", "Radio Guest Mix", "2026-06-30", 1802, "MP3", "Breaks", "CIUT 89.5", 216_000_000),
  ];
}

function read(): RecordingMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const initial = seed();
      window.localStorage.setItem(KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as RecordingMeta[];
  } catch {
    return [];
  }
}

function write(rows: RecordingMeta[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("djsr:recordings-changed"));
}

export const localRecordingRepository: RecordingRepository = {
  list: () => read().sort((a, b) => b.date.localeCompare(a.date)),
  get: (id) => read().find((r) => r.id === id),
  upsert(recording) {
    const rows = read();
    const idx = rows.findIndex((r) => r.id === recording.id);
    if (idx >= 0) rows[idx] = recording;
    else rows.unshift(recording);
    write(rows);
  },
  remove(id) {
    write(read().filter((r) => r.id !== id));
  },
};
