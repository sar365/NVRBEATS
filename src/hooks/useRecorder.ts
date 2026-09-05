/**
 * useRecorder — reads lightweight status from the NativeAudioBridge.
 *
 * The frontend never processes audio. It polls status at ~5 Hz and meter
 * levels at ~15 Hz only while recording. The authoritative duration always
 * comes from the native recorder; the on-screen timer is UI-only smoothing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getBridge } from "@/lib/native";
import type {
  AudioLevels,
  RecordingSettings,
  RecordingStatus,
} from "@/lib/native/types";

const IDLE_STATUS: RecordingStatus = {
  state: "READY",
  durationSec: 0,
  fileSizeBytes: 0,
  path: null,
  device: null,
  error: null,
  deviceChange: null,
  recovery: null,
};

export function useRecorder() {
  const bridge = getBridge();
  const [status, setStatus] = useState<RecordingStatus>(IDLE_STATUS);
  const [levels, setLevels] = useState<AudioLevels>({ left: 0, right: 0, mock: !bridge.isNative });
  const [inputLevels, setInputLevels] = useState<AudioLevels>({
    left: 0,
    right: 0,
    mock: !bridge.isNative,
  });
  const busy = useRef(false);

  const poll = useCallback(async () => {
    try {
      const next = await bridge.getRecordingStatus();
      setStatus(next);
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        state: "ERROR",
        error: {
          code: "NATIVE_ENGINE_UNAVAILABLE",
          message: "The Windows audio engine is not connected.",
          detail: String(error),
        },
      }));
    }
  }, [bridge]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(poll, 200);
    return () => window.clearInterval(id);
  }, [poll]);

  

  // Meters run continuously: the input meter shows the live preview signal even
  // before recording starts, the output meter shows what is being written.
  useEffect(() => {
    const tick = () => {
      void bridge.getAudioLevels().then(setLevels);
      void bridge.getInputAudioLevels().then(setInputLevels);
    };
    tick();
    const id = window.setInterval(tick, 66);
    return () => window.clearInterval(id);
  }, [bridge]);

  const start = useCallback(
    async (settings: RecordingSettings) => {
      if (busy.current) return;
      busy.current = true;
      setStatus((prev) => ({ ...prev, state: "STARTING", error: null }));
      try {
        setStatus(await bridge.startRecording(settings));
      } catch (error) {
        setStatus((prev) => ({
          ...prev,
          state: "ERROR",
          error: {
            code: "RECORDING_FAILED",
            message: "Audio recording could not be started.",
            detail: String(error),
          },
        }));
      } finally {
        busy.current = false;
      }
    },
    [bridge],
  );

  const stop = useCallback(async () => {
    if (busy.current) return null;
    busy.current = true;
    try {
      const final = await bridge.stopRecording();
      setStatus(final);
      return final;
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        state: "ERROR",
        error: {
          code: "RECORDING_FAILED",
          message: "The recording could not be finalized.",
          detail: String(error),
        },
      }));
      return null;
    } finally {
      busy.current = false;
    }
  }, [bridge]);

  const acknowledge = useCallback(() => {
    setStatus((prev) => ({ ...prev, state: "READY", error: null, deviceChange: null }));
  }, []);

  return { bridge, status, levels, inputLevels, start, stop, acknowledge, refresh: poll };
}
