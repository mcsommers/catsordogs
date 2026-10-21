/** Featured interest pills on Build Profile (03); full list is on 03e. */
export const BUILD_PROFILE_FEATURED_INTERESTS: readonly string[] = [
  'Art',
  'Camping',
  'Coffee',
  'Comedy',
  'Concerts',
  'Cooking',
  'Dancing',
  'Foodie',
  'Gym',
  'Hiking',
  'Movies',
  'Music',
  'Netflix',
  'Outdoors',
  'Photography',
  'Podcasts',
  'Reading',
  'Travel',
  'Walking',
  'Wine',
  'Yoga',
];

export function featuredInterestsOnProfile(allOptions: string[]): string[] {
  const allowed = new Set(allOptions);
  return BUILD_PROFILE_FEATURED_INTERESTS.filter((value) => allowed.has(value));
}
