import { describeAuthError, isNetworkError } from './authErrors';

describe('auth error wording', () => {
  it('does not say whether the email or the password was wrong', () => {
    const problem = describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    expect(problem).toEqual({ kind: 'wrong_credentials', message: expect.stringMatching(/email and password don/) });
  });

  it('tells someone who has not confirmed their email to check it', () => {
    expect(describeAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' })?.kind).toBe('email_not_confirmed');
    expect(describeAuthError({ message: 'Email not confirmed' })?.kind).toBe('email_not_confirmed');
  });

  it('explains rate limits and weak passwords plainly', () => {
    expect(describeAuthError({ status: 429, message: 'x' })?.message).toMatch(/Too many tries/);
    expect(describeAuthError({ code: 'weak_password', message: 'Password should be at least 8 characters' })?.message).toMatch(/8 characters/);
  });

  it('recognises lost connections', () => {
    expect(isNetworkError({ message: 'Network request failed' })).toBe(true);
    expect(isNetworkError({ message: 'Birthday cannot be in the future.' })).toBe(false);
    expect(describeAuthError({ message: 'Network request failed' })?.message).toMatch(/connection/);
  });

  it('returns null when there is no error', () => {
    expect(describeAuthError(null)).toBeNull();
  });
});
