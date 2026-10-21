import { hasProfilePhoto } from './ProfilePhotoRequiredHint';

describe('hasProfilePhoto', () => {
  it('is false with no position-1 photo', () => {
    expect(hasProfilePhoto([])).toBe(false);
    expect(hasProfilePhoto([{ position: 2 }])).toBe(false);
  });

  it('is true when position 1 exists', () => {
    expect(hasProfilePhoto([{ position: 1 }])).toBe(true);
    expect(hasProfilePhoto([{ position: 1 }, { position: 2 }])).toBe(true);
  });
});
