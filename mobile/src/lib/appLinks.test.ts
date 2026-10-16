import { hrefForAppDeepLink, parseAppDeepLink } from './appLinks';

describe('parseAppDeepLink', () => {
  it('ignores auth callback links', () => {
    expect(parseAppDeepLink('catsordogs://auth-callback?code=abc')).toBeNull();
  });

  it('maps feed, matches, chat, and notifications', () => {
    expect(parseAppDeepLink('catsordogs://feed')).toEqual({ screen: '/feed' });
    expect(parseAppDeepLink('catsordogs://matches?segment=incoming')).toEqual({
      screen: '/matches',
      segment: 'incoming',
    });
    expect(parseAppDeepLink('catsordogs://notifications')).toEqual({ screen: '/notifications' });
    expect(parseAppDeepLink('catsordogs://chat/m1')).toEqual({
      screen: '/chat/[matchId]',
      matchId: 'm1',
    });
  });

  it('builds expo-router hrefs', () => {
    expect(hrefForAppDeepLink({ screen: '/matches', segment: 'incoming' })).toBe(
      '/matches?segment=incoming',
    );
    expect(hrefForAppDeepLink({ screen: '/chat/[matchId]', matchId: 'abc' })).toBe('/chat/abc');
  });
});
