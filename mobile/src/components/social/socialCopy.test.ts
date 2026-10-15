import { pronouns } from './socialCopy';

describe('confirmation pronouns', () => {
  it('uses she/her for Woman', () => {
    const p = pronouns('Woman');
    expect(p.Subject).toBe('She');
    expect(p.object).toBe('her');
    expect(p.possessive).toBe('her');
    expect(p.matches).toBe('matches');
  });

  it('uses he/him for Man', () => {
    const p = pronouns('Man');
    expect(p.Subject).toBe('He');
    expect(p.object).toBe('him');
    expect(p.possessive).toBe('his');
    expect(p.matches).toBe('matches');
  });

  it('uses they/them for More genders or missing gender', () => {
    expect(pronouns('Non-binary').Subject).toBe('They');
    expect(pronouns('Non-binary').object).toBe('them');
    expect(pronouns('Non-binary').matches).toBe('match');
    expect(pronouns(null).Subject).toBe('They');
    expect(pronouns(undefined).object).toBe('them');
  });
});
