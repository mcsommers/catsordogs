import {
  getGenderPickerRequest,
  getInterestsPickerRequest,
  sameChoices,
  setProfilePickerRequest,
} from './profilePicker';

describe('profilePicker', () => {
  afterEach(() => setProfilePickerRequest(null));

  it('hands each screen only its own request', () => {
    setProfilePickerRequest({ kind: 'gender', options: ['Agender'], value: null, onDone: () => {} });
    expect(getGenderPickerRequest()?.options).toEqual(['Agender']);
    expect(getInterestsPickerRequest()).toBeNull();
  });

  it('returns nothing once cleared', () => {
    setProfilePickerRequest({ kind: 'interests', options: ['Yoga'], value: [], max: 5, onDone: () => {} });
    setProfilePickerRequest(null);
    expect(getInterestsPickerRequest()).toBeNull();
  });

  it('compares picks regardless of order', () => {
    expect(sameChoices(['Coffee', 'Hiking'], ['Hiking', 'Coffee'])).toBe(true);
    expect(sameChoices(['Coffee'], ['Coffee', 'Hiking'])).toBe(false);
    expect(sameChoices([], [])).toBe(true);
  });
});
