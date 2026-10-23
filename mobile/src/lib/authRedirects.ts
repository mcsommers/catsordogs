import * as Linking from 'expo-linking';
import { isExpoGo } from './canRegisterForRemotePush';

/** Installed builds: HTTPS so Gmail/Chrome on Android can open the app (App Links + open-app fallback). */
export const AUTH_CALLBACK_HTTPS = 'https://catsordogs.net/auth-callback';

/** Force Expo Go links to use exp:// so they are not replaced by the app scheme (catsordogs://). */
function expoGoAuthCallback(queryParams?: Record<string, string>): string {
  return Linking.createURL('auth-callback', {
    scheme: 'exp',
    ...(queryParams ? { queryParams } : {}),
  });
}

/** Where email confirmation links send people back to: this app's auth-callback screen. */
export function confirmationRedirect(): string {
  if (isExpoGo()) return expoGoAuthCallback();
  return AUTH_CALLBACK_HTTPS;
}

/** Where password reset links send people: auth-callback, which then opens Set New Password. */
export function resetRedirect(): string {
  if (isExpoGo()) return expoGoAuthCallback({ next: 'reset' });
  return `${AUTH_CALLBACK_HTTPS}?next=reset`;
}
