export type AuthProblem =
  | { kind: 'wrong_credentials'; message: string }
  | { kind: 'email_not_confirmed'; message: string }
  | { kind: 'other'; message: string };

const NETWORK_MESSAGE = 'We couldn\u2019t reach the server. Check your connection and try again.';

/** Turns a Supabase auth error into wording for the person using the app. */
export function describeAuthError(error: { message?: string; code?: string; status?: number } | null): AuthProblem | null {
  if (!error) return null;
  const code = error.code ?? '';
  const message = error.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return { kind: 'wrong_credentials', message: 'That email and password don\u2019t match. Try again.' };
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return {
      kind: 'email_not_confirmed',
      message: 'Confirm your email first. Tap the link we sent you, or send a new one.',
    };
  }
  if (code === 'weak_password' || /password should be at least/i.test(message)) {
    return { kind: 'other', message: 'Your password needs at least 8 characters.' };
  }
  if (code === 'same_password') {
    return { kind: 'other', message: 'Choose a password you haven\u2019t used for this account.' };
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) {
    return { kind: 'other', message: 'Too many tries. Wait a minute, then try again.' };
  }
  if (/network|fetch/i.test(message)) return { kind: 'other', message: NETWORK_MESSAGE };
  return { kind: 'other', message: message || NETWORK_MESSAGE };
}

export function isNetworkError(error: { message?: string } | null | undefined): boolean {
  return !!error && /network request failed|failed to fetch|network|timed out/i.test(error.message ?? '');
}
