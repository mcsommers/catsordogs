import type { GateState } from './api';

export type StartRoute = '/welcome' | '/build-profile' | '/question' | '/feed';

/**
 * Where the app opens. Signed-out people see Welcome; an unfinished profile
 * goes to Build Profile; until today's question is answered the daily gate
 * comes first; otherwise the Feed tab. With no question today the Feed tab
 * shows No Question Today, so Matches and Profile stay one tap away.
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
  if (input.gate === 'open' || input.gate === 'no_question_today') return '/feed';
  return '/question';
}
