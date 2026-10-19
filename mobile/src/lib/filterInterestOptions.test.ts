import { filterInterestOptions } from './filterInterestOptions';

describe('filterInterestOptions', () => {
  const options = ['Coffee', 'Hiking', 'BBQ', 'Electronic Music'];

  it('returns all options when the query is empty', () => {
    expect(filterInterestOptions(options, '')).toEqual(options);
    expect(filterInterestOptions(options, '   ')).toEqual(options);
  });

  it('filters case-insensitively by substring', () => {
    expect(filterInterestOptions(options, 'bb')).toEqual(['BBQ']);
    expect(filterInterestOptions(options, 'music')).toEqual(['Electronic Music']);
  });
});
