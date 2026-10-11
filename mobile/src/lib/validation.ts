export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export type CredentialField = 'email' | 'password';

/** Field-level sign-up / log-in validation (first error wins for scrolling). */
export function credentialFieldErrors(
  email: string,
  password: string
): Partial<Record<CredentialField, string>> {
  const errors: Partial<Record<CredentialField, string>> = {};
  if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

/** A message to show under the form, or null when the email and password can be sent. */
export function credentialsProblem(email: string, password: string): string | null {
  const errors = credentialFieldErrors(email, password);
  return errors.email ?? errors.password ?? null;
}

export function loginFieldErrors(email: string, password: string): Partial<Record<CredentialField, string>> {
  const errors: Partial<Record<CredentialField, string>> = {};
  if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  else if (!password) errors.password = 'Enter your password.';
  return errors;
}
