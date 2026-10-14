import {
  profileHasUnsavedChanges,
  snapshotProfileForm,
  snapshotProfilePhotos,
  type ProfileDraft,
} from './profileDirty';

const base: ProfileDraft = {
  first_name: 'Alex',
  birthday: '2000-01-01',
  gender: 'Woman',
  sexual_orientation: ['Straight'],
  height_feet: '5',
  height_inches: '9',
  city: 'Brooklyn, NY',
  occupation: '',
  school: '',
  about_me: '',
  lifestyle_tags: [],
  interested_in: [],
  relationship_goal: null,
};

describe('profileDirty', () => {
  it('detects form edits', () => {
    const baseline = { form: snapshotProfileForm(base), photos: snapshotProfilePhotos([]) };
    expect(profileHasUnsavedChanges({ ...base, about_me: 'Hi' }, [], baseline)).toBe(true);
    expect(profileHasUnsavedChanges(base, [], baseline)).toBe(false);
  });

  it('detects pending photo uploads', () => {
    const baseline = { form: snapshotProfileForm(base), photos: snapshotProfilePhotos([]) };
    expect(
      profileHasUnsavedChanges(base, [{ id: 'pending-1', position: 1, storage_path: 'x/y.jpg' }], baseline)
    ).toBe(true);
  });
});
