/** Matches the State column on the Videos page: answer status when present, else video status. */
export function videoDisplayState(row: {
  answer_status: string | null;
  video_status: string;
}): string {
  return row.answer_status ?? row.video_status;
}

/** Every value that can appear in the State column, in a sensible order for admins. */
export const VIDEO_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'disabled', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
  { value: 'ready', label: 'Ready (not submitted)' },
  { value: 'awaiting_upload', label: 'Awaiting upload' },
  { value: 'processing', label: 'Processing' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];
