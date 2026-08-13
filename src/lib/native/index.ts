import type { NativeAudioBridge } from "./bridge";
import { mockBridge } from "./mock-adapter";
import { TauriAudioBridge } from "./tauri-adapter";

let cached: NativeAudioBridge | null = null;

/** True when running inside the native Windows desktop build. */
export function isNativeRuntime(): boolean {
  return typeof globalThis !== "undefined" && "__TAURI__" in (globalThis as object);
}

/**
 * Returns the real native bridge in the Windows desktop build, and the clearly
 * labelled Development Mock Adapter in the browser preview.
 */
export function getBridge(): NativeAudioBridge {
  if (!cached) cached = isNativeRuntime() ? new TauriAudioBridge() : mockBridge;
  return cached;
}

export { mockBridge };
export type { NativeAudioBridge };
export * from "./types";
