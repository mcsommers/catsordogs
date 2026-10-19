import { tryToggleInterest } from './tryToggleInterest';

describe('tryToggleInterest', () => {
  it('adds and removes picks', () => {
    expect(tryToggleInterest([], 'Coffee', 5)).toEqual({ list: ['Coffee'], blockedByLimit: false });
    expect(tryToggleInterest(['Coffee', 'Hiking'], 'Coffee', 5)).toEqual({
      list: ['Hiking'],
      blockedByLimit: false,
    });
  });

  it('blocks a sixth pick', () => {
    const five = ['A', 'B', 'C', 'D', 'E'];
    expect(tryToggleInterest(five, 'F', 5)).toEqual({ list: five, blockedByLimit: true });
  });
});
