import type { GateState } from './api';

export type StartRoute = '/welcome' | '/build-profile' | '/feed';

/**
 * Where the app opens. Signed-out people see Welcome; an unfinished profile
 * goes to Build Profile; a finished profile opens the Feed tab. If they have
 * not answered today, that tab shows Feed Locked (06m) with a button into
 * Today's Question. With no question today it shows No Question Today.
 * Matches and Profile stay one tap away.
 */
const SIGNED_OUT_SCREENS = new Set(['', 'index', 'welcome', 'sign-up', 'log-in', 'forgot-password', 'check-email', 'auth-callback', 'set-new-password']);

/** True when a signed-out person is on a screen that needs an account, so they belong on Welcome. */
export function needsSignIn(firstSegment: string | undefined, signedIn: boolean): boolean {
  return !signedIn && !SIGNED_OUT_SCREENS.has(firstSegment ?? '');
}

export function startRoute(input: {
  signedIn: boolean;
  profileCompleted: boolean;
  gate: GateState | null;
}): StartRoute {
  if (!input.signedIn) return '/welcome';
  if (!input.profileCompleted || input.gate === 'profile_incomplete') return '/build-profile';
  return '/feed';
}
