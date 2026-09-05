/**
 * Export a recording by copying it to a folder the user picks.
 * The folder picker and the copy itself are native operations.
 */
import { toast } from "sonner";
import { getBridge } from "@/lib/native";
import type { RecordingMeta } from "@/lib/native/types";

export async function exportRecording(recording: RecordingMeta) {
  const bridge = getBridge();
  let folder: string | null = null;
  try {
    folder = await bridge.chooseRecordingFolder();
  } catch (error) {
    toast.error("The folder picker could not be opened.", { description: String(error) });
    return null;
  }
  if (!folder) return null;

  const pending = toast.loading(`Exporting “${recording.set_name}”…`);
  try {
    const { outputPath } = await bridge.exportRecording({
      recordingId: recording.id,
      filepath: recording.filepath,
      destinationFolder: folder,
    });
    toast.success("Export complete", {
      id: pending,
      description: outputPath,
      action: {
        label: "Open folder",
        onClick: () => void bridge.openRecordingFolder(outputPath),
      },
    });
    return outputPath;
  } catch (error) {
    toast.error("The export could not be completed.", {
      id: pending,
      description: String(error),
    });
    return null;
  }
}
