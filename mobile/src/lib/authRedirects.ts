import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { isExpoGo } from './canRegisterForRemotePush';

/** Installed builds: HTTPS so Gmail/Chrome on Android can open the app (App Links + open-app fallback). */
export const AUTH_CALLBACK_HTTPS = 'https://catsordogs.net/auth-callback';

function normalizeExpoOrigin(raw: string): string | null {
  const trimmed = raw.replace(/\/--\/?$/, '').replace(/\/$/, '');
  if (trimmed.startsWith('exp://') || trimmed.startsWith('exps://')) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.length > 0) return `exp://${trimmed}`;
  return null;
}

/** Metro / Cloudflare tunnel origin for Expo Go (exp://host, no /--/ suffix). */
export function expoGoLinkingOrigin(): string | null {
  const candidates = [
    Constants.linkingUri,
    Constants.experienceUrl,
    Constants.expoConfig?.hostUri,
  ];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const origin = normalizeExpoOrigin(raw);
    if (origin) return origin;
  }
  return null;
}

function isCompleteExpoGoCallback(url: string): boolean {
  if (!url.startsWith('exp://') && !url.startsWith('exps://')) return false;
  if (url.startsWith('exp://auth-callback') || url.startsWith('exps://auth-callback')) return false;
  return url.includes('/--/');
}

function querySuffix(queryParams?: Record<string, string>): string {
  if (!queryParams) return '';
  const q = new URLSearchParams(queryParams).toString();
  return q ? `?${q}` : '';
}

/**
 * Expo Go confirmation links must include the dev server host (trycloudflare.com, etc.).
 * Linking.createURL often returns catsordogs:// on Android; never send that in email from Expo Go.
 */
function expoGoAuthCallback(queryParams?: Record<string, string>): string {
  const qs = querySuffix(queryParams);
  const origin = expoGoLinkingOrigin();
  if (origin) return `${origin}/--/auth-callback${qs}`;

  const fromCreate = Linking.createURL('auth-callback', queryParams ? { queryParams } : undefined);
  if (!fromCreate.startsWith('catsordogs://') && isCompleteExpoGoCallback(fromCreate)) {
    return fromCreate;
  }

  if (__DEV__) {
    console.error(
      '[authRedirects] Could not build Expo Go callback URL. Reload after npm run phone.',
      { linkingUri: Constants.linkingUri, experienceUrl: Constants.experienceUrl, fromCreate }
    );
  }
  return `${AUTH_CALLBACK_HTTPS}${qs}`;
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
