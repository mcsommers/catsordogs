import { navigateFromNotificationPayload } from './notificationNavigation';

describe('navigateFromNotificationPayload', () => {
  const push = jest.fn();
  const router = { push } as unknown as import('expo-router').Router;

  beforeEach(() => push.mockClear());

  it('routes daily question and nudge to question', () => {
    expect(navigateFromNotificationPayload(router, { kind: 'daily_question' })).toBe(true);
    expect(push).toHaveBeenCalledWith('/question');
    push.mockClear();
    expect(navigateFromNotificationPayload(router, { kind: 'nudge' })).toBe(true);
    expect(push).toHaveBeenCalledWith('/question');
  });

  it('routes match request to sender profile', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(navigateFromNotificationPayload(router, { kind: 'match_request', sender_id: id })).toBe(true);
    expect(push).toHaveBeenCalledWith(`/user/${id}`);
  });

  it('routes match and message to chat', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    navigateFromNotificationPayload(router, { kind: 'match', match_id: id });
    expect(push).toHaveBeenCalledWith(`/chat/${id}?justMatched=1`);
    push.mockClear();
    navigateFromNotificationPayload(router, { kind: 'message', match_id: id });
    expect(push).toHaveBeenCalledWith(`/chat/${id}`);
  });
});
