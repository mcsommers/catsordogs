// The recording being reviewed: kept in memory between Today's Question,
// Review & Submit and Edit Captions so the local file can play while the
// server processes the upload.
export type CurrentRecording = {
  videoId: string;
  uploadUrl: string;
  fileUri: string;
  /** Front-camera files on Android often play back mirrored; flip so review matches reality. */
  flipPlayback?: boolean;
  upload?: Promise<boolean>;
};

let current: CurrentRecording | null = null;

export function setCurrentRecording(recording: CurrentRecording | null) {
  current = recording;
}

export function getCurrentRecording(): CurrentRecording | null {
  return current;
}
