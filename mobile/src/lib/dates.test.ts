import { parseBirthdayInput } from './dates';

describe('parseBirthdayInput', () => {
  it('accepts a real date', () => {
    expect(parseBirthdayInput('2000-01-31')).toBe('2000-01-31');
  });
  it('rejects impossible dates and wrong formats', () => {
    expect(parseBirthdayInput('2000-02-30')).toBeNull();
    expect(parseBirthdayInput('01/31/2000')).toBeNull();
    expect(parseBirthdayInput('')).toBeNull();
  });
});
