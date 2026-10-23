import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { isExpoGo } from './canRegisterForRemotePush';

/** Installed builds: HTTPS so Gmail/Chrome on Android can open the app (App Links + open-app fallback). */
export const AUTH_CALLBACK_HTTPS = 'https://catsordogs.net/auth-callback';

/** Metro / tunnel origin for Expo Go (exp://host, no /--/ suffix). */
function expoGoLinkingOrigin(): string | null {
  const raw = Constants.linkingUri ?? Constants.expoConfig?.hostUri;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.replace(/\/--\/?$/, '').replace(/\/$/, '');
  if (!trimmed.startsWith('exp://') && !trimmed.startsWith('exps://')) return null;
  return trimmed;
}

function isCompleteExpoGoCallback(url: string): boolean {
  if (!url.startsWith('exp://') && !url.startsWith('exps://')) return false;
  if (url.startsWith('exp://auth-callback') || url.startsWith('exps://auth-callback')) return false;
  return url.includes('/--/');
}

/**
 * Expo Go confirmation links must include the dev server host (trycloudflare.com, etc.).
 * Forcing scheme: 'exp' alone produced broken exp://auth-callback URLs on Android and crashed Expo Go.
 */
function expoGoAuthCallback(queryParams?: Record<string, string>): string {
  const fromCreate = Linking.createURL('auth-callback', queryParams ? { queryParams } : undefined);
  if (!fromCreate.startsWith('catsordogs://') && isCompleteExpoGoCallback(fromCreate)) {
    return fromCreate;
  }

  const origin = expoGoLinkingOrigin();
  if (!origin) return fromCreate;

  const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';
  return `${origin}/--/auth-callback${qs}`;
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
