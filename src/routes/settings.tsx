import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/useSettings";
import { getBridge, isNativeRuntime } from "@/lib/native";
import type {
  AsioCaptureDevice,
  AudioFormat,
  BitDepth,
  OutputDevice,
  SampleRate,
} from "@/lib/native/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — NVRBEATS" },
      {
        name: "description",
        content:
          "Configure recording format, sample rate, bit depth, folder, filename template, auto record, tray behavior and advanced buffer settings.",
      },
      { property: "og:title", content: "Settings — NVRBEATS" },
      {
        property: "og:description",
        content: "Tune how NVRBEATS captures and stores your Windows output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="label-caps">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="w-56 max-w-full">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const { settings, update } = useSettings();
  const bridge = getBridge();
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const [asioDevices, setAsioDevices] = useState<AsioCaptureDevice[]>([]);
  const [asioDeviceError, setAsioDeviceError] = useState<string | null>(null);

  useEffect(() => {
    void bridge.getOutputDevices().then(setDevices);
    void bridge
      .getAsioCaptureDevices()
      .then(setAsioDevices)
      .catch((error) => {
        setAsioDeviceError(String(error));
      });
  }, [bridge]);

  const selectedAsioDevice = asioDevices.find(
    (device) => device.driverName === settings.asioDriverName,
  );

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="mt-4 space-y-4">
        <Section title="Recording">
          <Field label="Recording format">
            <Select
              value={settings.format}
              onValueChange={(v) => update({ format: v as AudioFormat })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WAV">WAV</SelectItem>
                <SelectItem value="FLAC" disabled>
                  FLAC — unsupported
                </SelectItem>
                <SelectItem value="MP3" disabled>
                  MP3 — unsupported
                </SelectItem>
                <SelectItem value="AAC" disabled>
                  AAC — unsupported
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sample rate">
            <Select
              value={String(settings.sampleRate)}
              onValueChange={(v) => update({ sampleRate: Number(v) as SampleRate })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="44100">44.1 kHz</SelectItem>
                <SelectItem value="48000">48 kHz</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bit depth">
            <Select
              value={String(settings.bitDepth)}
              onValueChange={(v) => update({ bitDepth: Number(v) as BitDepth })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16">16-bit</SelectItem>
                <SelectItem value="24">24-bit</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Recording folder" hint={settings.folder}>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                const folder = await bridge.chooseRecordingFolder();
                if (folder) update({ folder });
              }}
            >
              <FolderOpen className="size-3.5" /> Choose Folder
            </Button>
          </Field>
          <Field
            label="Filename template"
            hint="Variables: {date} {time} {artist} {setname} {genre} {location}"
          >
            <Input
              value={settings.filenameTemplate}
              onChange={(e) => update({ filenameTemplate: e.target.value })}
            />
          </Field>
        </Section>

        <Section title="Audio">
          <Field label="Capture source">
            <Select
              value={settings.captureBackend}
              onValueChange={(value) => {
                if (value === "asio_loopback") {
                  const firstUsable = asioDevices.find((device) => device.inputChannels >= 2);
                  update({
                    captureBackend: "asio_loopback",
                    asioDriverName: settings.asioDriverName ?? firstUsable?.driverName ?? null,
                    asioChannelPair: [0, 1],
                  });
                } else {
                  update({ captureBackend: "wasapi_loopback" });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wasapi_loopback">Windows output (WASAPI)</SelectItem>
                <SelectItem
                  value="asio_loopback"
                  disabled={!asioDevices.some((device) => device.inputChannels >= 2)}
                >
                  ASIO playback loopback inputs
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {settings.captureBackend === "asio_loopback" ? (
            <>
              <Field
                label="ASIO driver"
                hint="The driver must expose inputs carrying its playback mix."
              >
                <Select
                  value={settings.asioDriverName ?? ""}
                  onValueChange={(driverName) =>
                    update({ asioDriverName: driverName, asioChannelPair: [0, 1] })
                  }
                  disabled={!asioDevices.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No ASIO driver with inputs found" />
                  </SelectTrigger>
                  <SelectContent>
                    {asioDevices
                      .filter((device) => device.inputChannels >= 2)
                      .map((device) => (
                        <SelectItem key={device.driverName} value={device.driverName}>
                          {device.driverName} ({device.inputChannels} inputs)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              {selectedAsioDevice ? (
                <>
                  {([0, 1] as const).map((side) => (
                    <Field
                      key={side}
                      label={`${side === 0 ? "Left" : "Right"} loopback input channel`}
                    >
                      <Select
                        value={String(settings.asioChannelPair[side])}
                        onValueChange={(value) => {
                          const pair: [number, number] = [...settings.asioChannelPair];
                          pair[side] = Number(value);
                          update({ asioChannelPair: pair });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            { length: selectedAsioDevice.inputChannels },
                            (_, i) => i,
                          ).map((channel) => (
                            <SelectItem
                              key={channel}
                              value={String(channel)}
                              disabled={channel === settings.asioChannelPair[1 - side]}
                            >
                              Input {channel + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ))}
                  <p className="text-xs text-warn">
                    ASIO does not label loopback channels. Map the driver's playback loopback to
                    these inputs, then verify the live meter follows playback. Some ASIO drivers are
                    exclusive and cannot run alongside the app producing audio.
                  </p>
                </>
              ) : (
                <p className="text-xs text-warn">
                  Select a driver with at least two inputs. Those inputs must be driver-provided
                  playback loopback channels; ordinary mic/line inputs will not capture system
                  playback.
                  {asioDeviceError ? ` Driver enumeration: ${asioDeviceError}` : ""}
                </p>
              )}
            </>
          ) : (
            <>
              <Field label="Output device">
                <Select
                  value={
                    settings.followWindowsDefault
                      ? "follow-default"
                      : (settings.outputDeviceId ?? "")
                  }
                  onValueChange={(value) =>
                    value === "follow-default"
                      ? update({ followWindowsDefault: true, outputDeviceId: null })
                      : update({ followWindowsDefault: false, outputDeviceId: value })
                  }
                  disabled={devices.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No output devices available" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow-default">Follow Windows Default</SelectItem>
                    {devices.map((d) => (
                      <SelectItem key={d.id} value={d.id} disabled={d.status !== "CONNECTED"}>
                        {d.name}
                        {d.isDefault ? " (Windows default)" : ""}
                        {d.status !== "CONNECTED" ? " (unavailable)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {!settings.followWindowsDefault &&
              !devices.some((device) => device.id === settings.outputDeviceId) ? (
                <p className="text-xs text-warn">
                  The saved output device is unavailable. Select another device or Follow Windows
                  Default.
                </p>
              ) : null}
              <Field label="Device-change behavior">
                <Select
                  value={settings.deviceChangeBehavior}
                  onValueChange={(v) =>
                    update({ deviceChangeBehavior: v as typeof settings.deviceChangeBehavior })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTINUE">Continue on old device</SelectItem>
                    <SelectItem value="SWITCH">Switch to new device</SelectItem>
                    <SelectItem value="STOP">Stop recording</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </Section>

        <Section title="Auto Record">
          <p className="text-xs text-muted-foreground">
            Signal detection is performed by the native audio engine, never in the browser.
          </p>
          <Field label="Enable Auto Record">
            <div className="flex justify-end">
              <Switch
                checked={settings.autoRecord.enabled}
                onCheckedChange={(v) =>
                  update({ autoRecord: { ...settings.autoRecord, enabled: v } })
                }
              />
            </div>
          </Field>
          <Field label="Start threshold (dBFS)">
            <Input
              type="number"
              value={settings.autoRecord.startThresholdDb}
              onChange={(e) =>
                update({
                  autoRecord: { ...settings.autoRecord, startThresholdDb: Number(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Stop after silence (seconds)">
            <Input
              type="number"
              value={settings.autoRecord.stopAfterSilenceSec}
              onChange={(e) =>
                update({
                  autoRecord: {
                    ...settings.autoRecord,
                    stopAfterSilenceSec: Number(e.target.value),
                  },
                })
              }
            />
          </Field>
          <Field label="Minimum recording length (seconds)">
            <Input
              type="number"
              value={settings.autoRecord.minimumLengthSec}
              onChange={(e) =>
                update({
                  autoRecord: { ...settings.autoRecord, minimumLengthSec: Number(e.target.value) },
                })
              }
            />
          </Field>
        </Section>

        <Section title="Appearance">
          <Field label="Theme">
            <Select
              value={settings.appearance}
              onValueChange={(v) => update({ appearance: v as "dark" | "light" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark mode</SelectItem>
                <SelectItem value="light">Light mode</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Minimize to tray" hint="Requires the Windows desktop build">
            <div className="flex justify-end">
              <Switch
                checked={settings.minimizeToTray}
                onCheckedChange={(v) => update({ minimizeToTray: v })}
              />
            </div>
          </Field>
        </Section>

        <Section title="Startup">
          <Field label="Start with Windows" hint="Requires the Windows desktop build">
            <div className="flex justify-end">
              <Switch
                checked={settings.startWithWindows}
                onCheckedChange={(v) => update({ startWithWindows: v })}
              />
            </div>
          </Field>
        </Section>

        <Section title="Advanced">
          <Field label="Buffer size (ms)" hint="Bounded capture buffer used by the native writer">
            <Input
              type="number"
              value={settings.advanced.bufferSizeMs}
              onChange={(e) =>
                update({ advanced: { ...settings.advanced, bufferSizeMs: Number(e.target.value) } })
              }
            />
          </Field>
          <Field label="Crash recovery" hint="Keep partial files for recovery after a crash">
            <div className="flex justify-end">
              <Switch
                checked={settings.advanced.crashRecovery}
                onCheckedChange={(v) =>
                  update({ advanced: { ...settings.advanced, crashRecovery: v } })
                }
              />
            </div>
          </Field>
          <Field label="Diagnostic logging">
            <div className="flex justify-end">
              <Switch
                checked={settings.advanced.diagnosticLogging}
                onCheckedChange={(v) =>
                  update({ advanced: { ...settings.advanced, diagnosticLogging: v } })
                }
              />
            </div>
          </Field>
        </Section>

        <Section title="Development Mode">
          <p className="text-sm">
            Native Windows Audio Engine:{" "}
            <span className={isNativeRuntime() ? "text-online" : "text-warn"}>
              {isNativeRuntime() ? "Connected" : "Not Connected"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Adapter in use: {bridge.adapterName}. The web preview cannot access WASAPI. Install/run
            the Windows desktop version to record real system audio.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
