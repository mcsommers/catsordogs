import {
  firstRouteParam,
  navigateFromNotificationPayload,
  pathFromNotificationUrl,
  pushAppPath,
} from './notificationNavigation';

describe('pathFromNotificationUrl', () => {
  const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const matchId = '11111111-2222-3333-4444-555555555555';

  it('reads https email links', () => {
    expect(pathFromNotificationUrl(`https://catsordogs.net/user/${userId}`)).toBe(`/user/${userId}`);
    expect(pathFromNotificationUrl(`https://catsordogs.net/chat/${matchId}`)).toBe(`/chat/${matchId}`);
    expect(pathFromNotificationUrl('https://catsordogs.net/question')).toBe('/question');
  });

  it('reads custom scheme and Android intent URLs', () => {
    expect(pathFromNotificationUrl(`catsordogs://user/${userId}`)).toBe(`/user/${userId}`);
    expect(
      pathFromNotificationUrl(
        `intent://catsordogs.net/user/${userId}#Intent;scheme=https;package=net.catsordogs.app;end`,
      ),
    ).toBe(`/user/${userId}`);
    expect(pathFromNotificationUrl('catsordogs://notifications')).toBe('/notifications');
  });

  it('ignores empty and marketing fallbacks', () => {
    expect(pathFromNotificationUrl(null)).toBe(null);
    expect(pathFromNotificationUrl('https://catsordogs.net/open-app')).toBe(null);
  });
});

describe('firstRouteParam', () => {
  it('unwraps Expo Router array params', () => {
    expect(firstRouteParam(['abc'])).toBe('abc');
    expect(firstRouteParam('abc')).toBe('abc');
    expect(firstRouteParam(undefined)).toBe(undefined);
  });
});

describe('navigateFromNotificationPayload', () => {
  const push = jest.fn();
  const router = { push } as unknown as import('expo-router').ImperativeRouter;

  beforeEach(() => push.mockClear());

  it('routes daily question and nudge to question', () => {
    expect(navigateFromNotificationPayload(router, { kind: 'daily_question' })).toBe(true);
    expect(push).toHaveBeenCalledWith('/question');
    push.mockClear();
    expect(navigateFromNotificationPayload(router, { kind: 'nudge' })).toBe(true);
    expect(push).toHaveBeenCalledWith('/question');
  });

  it('routes match request to sender profile with a typed route', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(navigateFromNotificationPayload(router, { kind: 'match_request', sender_id: id })).toBe(true);
    expect(push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id } });
  });

  it('routes match and message to chat with a typed route', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    navigateFromNotificationPayload(router, { kind: 'match', match_id: id });
    expect(push).toHaveBeenCalledWith({
      pathname: '/chat/[matchId]',
      params: { matchId: id, justMatched: '1' },
    });
    push.mockClear();
    navigateFromNotificationPayload(router, { kind: 'message', match_id: id });
    expect(push).toHaveBeenCalledWith({ pathname: '/chat/[matchId]', params: { matchId: id } });
  });
});

describe('pushAppPath', () => {
  it('rejects unknown paths', () => {
    const push = jest.fn();
    const router = { push } as unknown as import('expo-router').ImperativeRouter;
    expect(pushAppPath(router, '/open-app')).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
