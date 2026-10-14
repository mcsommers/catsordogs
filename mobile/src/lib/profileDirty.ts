/** Normalized profile draft used to detect unsaved edits on Build / Edit Profile. */
export type ProfileDraft = {
  first_name: string;
  birthday: string | null;
  gender: string | null;
  sexual_orientation: string[];
  height_feet: string;
  height_inches: string;
  city: string;
  occupation: string;
  school: string;
  about_me: string;
  lifestyle_tags: string[];
  interested_in: string[];
  relationship_goal: string | null;
};

export type ProfilePhotoDraft = { id: string; position: number; storage_path: string };

export const DISCARD_PROFILE_TITLE = 'Discard changes?';
export const DISCARD_PROFILE_BODY =
  'You have unsaved edits to your profile. If you leave now, your changes won\u2019t be saved.';
export const DISCARD_PROFILE_LEAVE = 'Leave Without Saving';
export const DISCARD_PROFILE_KEEP = 'Keep Editing';

function sortedStrings(values: string[]): string[] {
  return [...values].sort();
}

export function snapshotProfileForm(form: ProfileDraft): string {
  return JSON.stringify({
    first_name: form.first_name.trim(),
    birthday: form.birthday,
    gender: form.gender,
    sexual_orientation: sortedStrings(form.sexual_orientation),
    height_feet: form.height_feet.trim(),
    height_inches: form.height_inches.trim(),
    city: form.city.trim(),
    occupation: form.occupation.trim(),
    school: form.school.trim(),
    about_me: form.about_me.trim(),
    lifestyle_tags: sortedStrings(form.lifestyle_tags),
    interested_in: sortedStrings(form.interested_in),
    relationship_goal: form.relationship_goal,
  });
}

export function snapshotProfilePhotos(photos: ProfilePhotoDraft[]): string {
  const rows = photos
    .filter((p) => !String(p.id).startsWith('pending-'))
    .map((p) => ({ position: p.position, storage_path: p.storage_path }))
    .sort((a, b) => a.position - b.position);
  return JSON.stringify(rows);
}

export function profileHasUnsavedChanges(
  form: ProfileDraft,
  photos: ProfilePhotoDraft[],
  baseline: { form: string; photos: string } | null
): boolean {
  if (!baseline) return false;
  if (photos.some((p) => String(p.id).startsWith('pending-'))) return true;
  return (
    snapshotProfileForm(form) !== baseline.form || snapshotProfilePhotos(photos) !== baseline.photos
  );
}
