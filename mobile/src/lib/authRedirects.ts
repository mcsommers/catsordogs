import * as Linking from 'expo-linking';

/** Where email confirmation links send people back to: this app's auth-callback screen. */
export function confirmationRedirect(): string {
  return Linking.createURL('auth-callback');
}

/** Where password reset links send people: auth-callback, which then opens Set New Password. */
export function resetRedirect(): string {
  return Linking.createURL('auth-callback', { queryParams: { next: 'reset' } });
}
