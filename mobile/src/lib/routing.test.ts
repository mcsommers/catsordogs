import { needsSignIn, startRoute } from './routing';

describe('where the app opens', () => {
  it('sends signed-out people to Welcome', () => {
    expect(startRoute({ signedIn: false, profileCompleted: false, gate: null })).toBe('/welcome');
  });

  it('sends someone with an unfinished profile to Build Profile', () => {
    expect(startRoute({ signedIn: true, profileCompleted: false, gate: null })).toBe('/build-profile');
    expect(startRoute({ signedIn: true, profileCompleted: true, gate: 'profile_incomplete' })).toBe('/build-profile');
  });

  it("puts today's question first until it is answered", () => {
    expect(startRoute({ signedIn: true, profileCompleted: true, gate: 'not_answered' })).toBe('/question');
  });

  it('opens the Feed tab once today is answered', () => {
    expect(startRoute({ signedIn: true, profileCompleted: true, gate: 'open' })).toBe('/feed');
  });

  it('opens the Feed tab (No Question Today) when nothing is scheduled, so other tabs stay reachable', () => {
    expect(startRoute({ signedIn: true, profileCompleted: true, gate: 'no_question_today' })).toBe('/feed');
  });
});

describe('screens that need an account', () => {
  it('sends a signed-out person away from signed-in screens', () => {
    for (const screen of ['question', 'review', 'edit-captions', 'build-profile', 'how-it-works', '(tabs)']) {
      expect(needsSignIn(screen, false)).toBe(true);
    }
  });

  it('leaves the sign-in screens alone', () => {
    for (const screen of [undefined, 'welcome', 'sign-up', 'log-in', 'forgot-password', 'check-email', 'auth-callback', 'set-new-password']) {
      expect(needsSignIn(screen, false)).toBe(false);
    }
  });

  it('never redirects someone who is signed in', () => {
    expect(needsSignIn('question', true)).toBe(false);
  });
});
