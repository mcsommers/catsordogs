import { credentialsProblem, isValidEmail } from './validation';

describe('sign-up form checks', () => {
  it('accepts normal email addresses and trims spaces', () => {
    expect(isValidEmail('alex@example.com')).toBe(true);
    expect(isValidEmail('  alex@example.com ')).toBe(true);
  });

  it('rejects things that are not email addresses', () => {
    expect(isValidEmail('alex')).toBe(false);
    expect(isValidEmail('alex@example')).toBe(false);
    expect(isValidEmail('a lex@example.com')).toBe(false);
  });

  it('requires a password of at least 8 characters', () => {
    expect(credentialsProblem('alex@example.com', '1234567')).toMatch(/at least 8/);
    expect(credentialsProblem('alex@example.com', '12345678')).toBeNull();
  });

  it('checks the email before the password', () => {
    expect(credentialsProblem('nope', 'short')).toMatch(/email/);
  });
});
