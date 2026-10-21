import { BUILD_PROFILE_FEATURED_INTERESTS, featuredInterestsOnProfile } from './featuredInterests';

describe('BUILD_PROFILE_FEATURED_INTERESTS', () => {
  it('lists 21 featured interests in alphabetical order', () => {
    const sorted = [...BUILD_PROFILE_FEATURED_INTERESTS].sort((a, b) => a.localeCompare(b));
    expect(BUILD_PROFILE_FEATURED_INTERESTS).toEqual(sorted);
    expect(BUILD_PROFILE_FEATURED_INTERESTS).toHaveLength(21);
  });
});

describe('featuredInterestsOnProfile', () => {
  it('keeps only options that exist in the configured list', () => {
    expect(featuredInterestsOnProfile(['Coffee', 'Hiking', 'ZZZ'])).toEqual(['Coffee', 'Hiking']);
  });
});
