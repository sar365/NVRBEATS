/**
 * Minimal transport state for the local player.
 * Native builds delegate to native playback (see NativeAudioBridge.playRecording).
 * The browser preview only advances the transport position.
 */
import { useCallback, useEffect, useState } from "react";
import type { RecordingMeta } from "@/lib/native/types";

type PlayerState = {
  queue: RecordingMeta[];
  index: number;
  playing: boolean;
  position: number;
};

let state: PlayerState = { queue: [], index: -1, playing: false, position: 0 };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  emit();
}

export function playRecording(recording: RecordingMeta, queue: RecordingMeta[]) {
  const list = queue.length ? queue : [recording];
  set({
    queue: list,
    index: Math.max(0, list.findIndex((r) => r.id === recording.id)),
    playing: true,
    position: 0,
  });
}

export function usePlayer() {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const current = state.queue[state.index] ?? null;

  useEffect(() => {
    if (!state.playing || !current) return;
    const id = window.setInterval(() => {
      set({ position: Math.min(current.duration, state.position + 1) });
    }, 1000);
    return () => window.clearInterval(id);
  }, [current, state.playing, state.position]);

  const toggle = useCallback(() => set({ playing: !state.playing }), []);
  const seek = useCallback((position: number) => set({ position }), []);
  const next = useCallback(
    () => set({ index: Math.min(state.queue.length - 1, state.index + 1), position: 0 }),
    [],
  );
  const previous = useCallback(
    () => set({ index: Math.max(0, state.index - 1), position: 0 }),
    [],
  );

  return { current, playing: state.playing, position: state.position, toggle, seek, next, previous };
}
