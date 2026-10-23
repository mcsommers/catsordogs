import { isNetworkError } from './authErrors';

/** Adds or removes a choice. When the list is full, a new choice is ignored. */
export function toggleChoice(list: string[], value: string, max: number | null): string[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (max != null && list.length >= max) return list;
  return [...list, value];
}

export const SAVE_ERROR = 'We couldn\u2019t save your profile. Check your connection and try again.';
export const BIRTHDAY_ERROR = 'You must be 18 or older to join. Check your birthday.';

export const MIN_SIGNUP_AGE = 18;
export const MAX_BIRTHDAY_AGE_YEARS = 120;

/** Android needs an explicit minimum; otherwise the picker stops around 1969/1970. */
export function birthdayPickerMinimumDate(today = new Date()): Date {
  return new Date(today.getFullYear() - MAX_BIRTHDAY_AGE_YEARS, today.getMonth(), today.getDate());
}

export const PROFILE_CITY_FIELD_LABEL = 'City';
export const PROFILE_SCHOOL_FIELD_LABEL = 'School (high school, college, whatever)';
export const PROFILE_ADDITIONAL_PHOTOS_LABEL = 'Additional photos';

/** Matches the server’s `private.age_in_years` (whole years on a calendar date). */
export function ageInYears(birthdayIso: string, today = new Date()): number {
  const [y, m, d] = birthdayIso.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let years = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) years--;
  return years;
}

/** Message for the Birthday field, or null when the date is allowed. */
export function birthdayFieldProblem(birthdayIso: string | null, today = new Date()): string | null {
  if (!birthdayIso) return null;
  const [y, m, d] = birthdayIso.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birth > ref) return 'Birthday cannot be in the future.';
  const years = ageInYears(birthdayIso, today);
  if (years > MAX_BIRTHDAY_AGE_YEARS) return 'Please enter a valid birthday.';
  if (years < MIN_SIGNUP_AGE) return BIRTHDAY_ERROR;
  return null;
}

export type ProfileFinishField = 'photos' | 'first_name' | 'birthday' | 'gender' | 'height';

/** First blocking issue when tapping Finish Setup, in top-to-bottom screen order. */
export function firstProfileFinishIssue(args: {
  photoCount: number;
  firstName: string;
  birthday: string | null;
  gender: string | null;
  heightFeet: string;
  heightInches: string;
}): { field: ProfileFinishField; banner: string; birthdayError: boolean; heightError: boolean } | null {
  const missing: { field: ProfileFinishField; part: string }[] = [];
  if (!args.firstName.trim()) missing.push({ field: 'first_name', part: 'your first name' });
  if (!args.birthday) missing.push({ field: 'birthday', part: 'your birthday' });
  if (!args.gender) missing.push({ field: 'gender', part: 'your gender' });
  if (args.photoCount === 0) missing.push({ field: 'photos', part: 'a profile photo' });
  if (missing.length) {
    return {
      field: missing[0].field,
      banner: `Add ${missing.map((m) => m.part).join(', ')} to finish.`,
      birthdayError: false,
      heightError: false,
    };
  }
  const birthdayProblem = birthdayFieldProblem(args.birthday);
  if (birthdayProblem) {
    return { field: 'birthday', banner: birthdayProblem, birthdayError: true, heightError: false };
  }
  const height = parseHeightFtIn(args.heightFeet, args.heightInches);
  if (height === 'invalid') {
    return {
      field: 'height',
      banner: 'Enter a valid height (for example 5 ft 9 in).',
      birthdayError: false,
      heightError: true,
    };
  }
  return null;
}

/**
 * What 03c shows for a failed save. A birthday the server refuses (under 18,
 * in the future, impossible) marks the Birthday field; anything else shows the
 * banner, using the server's own wording when it explains the problem.
 */
export function profileSaveProblem(
  error: { message?: string; code?: string } | null,
  step: 'birthday' | 'details' | 'finish' | 'photo'
): { field: 'birthday' | null; banner: string | null } {
  if (!error) return { field: null, banner: null };
  if (isNetworkError(error)) return { field: null, banner: SAVE_ERROR };
  const message = error.message?.trim();
  if (step === 'birthday' && error.code === '23514' && message) {
    return { field: 'birthday', banner: null };
  }
  if (message) return { field: null, banner: message };
  return { field: null, banner: SAVE_ERROR };
}

export const MIN_HEIGHT_INCHES = 35;
export const MAX_HEIGHT_INCHES = 99;

/** Total inches for the server, or null when both fields are empty. */
export function parseHeightFtIn(feetText: string, inchesText: string): number | null | 'invalid' {
  const f = feetText.trim();
  const i = inchesText.trim();
  if (!f && !i) return null;
  if (!f) return 'invalid';
  const feet = Number(f);
  const inches = i === '' ? 0 : Number(i);
  if (!Number.isInteger(feet) || feet < 0 || feet > 8) return 'invalid';
  if (!Number.isInteger(inches) || inches < 0 || inches > 11) return 'invalid';
  const total = feet * 12 + inches;
  if (total < MIN_HEIGHT_INCHES || total > MAX_HEIGHT_INCHES) return 'invalid';
  return total;
}
