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
  show_gender: true,
  sexual_orientation: ['Straight'],
  show_orientation: true,
  height_feet: '5',
  height_inches: '9',
  city: 'Brooklyn, NY',
  occupation: '',
  school: '',
  about_me: '',
  interests: [],
  interested_in: [],
  relationship_goal: null,
};

describe('profileDirty', () => {
  it('detects form edits', () => {
    const baseline = { form: snapshotProfileForm(base), photos: snapshotProfilePhotos([]) };
    expect(profileHasUnsavedChanges({ ...base, about_me: 'Hi' }, [], baseline)).toBe(true);
    expect(profileHasUnsavedChanges(base, [], baseline)).toBe(false);
  });

  it('detects a changed Interests pick, gender switch, and orientation switch', () => {
    const baseline = { form: snapshotProfileForm(base), photos: snapshotProfilePhotos([]) };
    expect(profileHasUnsavedChanges({ ...base, interests: ['Coffee'] }, [], baseline)).toBe(true);
    expect(profileHasUnsavedChanges({ ...base, show_gender: false }, [], baseline)).toBe(true);
    expect(profileHasUnsavedChanges({ ...base, show_orientation: false }, [], baseline)).toBe(true);
  });

  it('ignores the order Interests were picked in', () => {
    const picked = { ...base, interests: ['Coffee', 'Hiking'] };
    const baseline = { form: snapshotProfileForm(picked), photos: snapshotProfilePhotos([]) };
    expect(profileHasUnsavedChanges({ ...picked, interests: ['Hiking', 'Coffee'] }, [], baseline)).toBe(false);
  });

  it('detects pending photo uploads', () => {
    const baseline = { form: snapshotProfileForm(base), photos: snapshotProfilePhotos([]) };
    expect(
      profileHasUnsavedChanges(base, [{ id: 'pending-1', position: 1, storage_path: 'x/y.jpg' }], baseline)
    ).toBe(true);
  });
});
