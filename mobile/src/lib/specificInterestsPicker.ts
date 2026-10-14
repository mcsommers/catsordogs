/**
 * Hands the Specific interests choice between Feed Settings (06i) and the
 * Specific Interests screen (06ia). Feed Settings stays mounted underneath, so
 * unsaved changes there are kept; every tap on 06ia reports through `onChange`.
 */
export type SpecificInterestsRequest = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
};

let pending: SpecificInterestsRequest | null = null;

export function setSpecificInterestsRequest(request: SpecificInterestsRequest | null) {
  pending = request;
}

export function getSpecificInterestsRequest(): SpecificInterestsRequest | null {
  return pending;
}
