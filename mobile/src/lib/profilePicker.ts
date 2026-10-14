/**
 * Hands a choice between Build / Edit Profile and the full-screen pickers
 * (03d Gender "More", 03e Interests). The form stays mounted underneath, so
 * nothing the person typed is lost; the picker reports its result through
 * `onDone` and the form updates its own state.
 */
export type GenderPickerRequest = {
  kind: 'gender';
  options: string[];
  value: string | null;
  onDone: (value: string) => void;
};

export type InterestsPickerRequest = {
  kind: 'interests';
  options: string[];
  value: string[];
  max: number;
  onDone: (value: string[]) => void;
};

type PickerRequest = GenderPickerRequest | InterestsPickerRequest;

let pending: PickerRequest | null = null;

export function setProfilePickerRequest(request: PickerRequest | null) {
  pending = request;
}

export function getGenderPickerRequest(): GenderPickerRequest | null {
  return pending?.kind === 'gender' ? pending : null;
}

export function getInterestsPickerRequest(): InterestsPickerRequest | null {
  return pending?.kind === 'interests' ? pending : null;
}

/** Interests screen helper: same picks, ignoring the order they were chosen in. */
export function sameChoices(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((value, i) => value === sortedB[i]);
}
