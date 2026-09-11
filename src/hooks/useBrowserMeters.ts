/**
 * Browser preview meters — a stand-in for the Windows engine while it is being
 * built. The user shares a tab/screen "with audio", and we read peak levels
 * from that stream. Nothing is recorded: samples never leave the analyser.
 *
 * The shipped Windows app does NOT use this path; it uses WASAPI loopback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioLevels } from "@/lib/native/types";

type Status = "off" | "starting" | "live" | "unsupported" | "denied";

export function useBrowserMeters() {
  const [status, setStatus] = useState<Status>("off");
  const [levels, setLevels] = useState<AudioLevels>({ left: 0, right: 0, mock: false });
  const cleanup = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setStatus("off");
    setLevels({ left: 0, right: 0, mock: false });
  }, []);

  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback(async () => {
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (!media?.getDisplayMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("starting");
    try {
      const stream = await media.getDisplayMedia({ video: true, audio: true });
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setStatus("denied");
        return;
      }
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const splitter = context.createChannelSplitter(2);
      const left = context.createAnalyser();
      const right = context.createAnalyser();
      left.fftSize = 1024;
      right.fftSize = 1024;
      source.connect(splitter);
      splitter.connect(left, 0);
      splitter.connect(right, 1);

      const bufferL = new Float32Array(left.fftSize);
      const bufferR = new Float32Array(right.fftSize);
      let frame = 0;
      const tick = () => {
        left.getFloatTimeDomainData(bufferL);
        right.getFloatTimeDomainData(bufferR);
        setLevels({ left: peak(bufferL), right: peak(bufferR), mock: false });
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);

      cleanup.current = () => {
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
      };
      stream.getAudioTracks()[0].addEventListener("ended", () => stop());
      setStatus("live");
    } catch {
      setStatus("denied");
    }
  }, [stop]);

  return { status, levels, start, stop };
}

function peak(buffer: Float32Array): number {
  let max = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = Math.abs(buffer[i]);
    if (value > max) max = value;
  }
  return Math.min(1, max);
}
