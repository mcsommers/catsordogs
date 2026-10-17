import { hasMatchesTabAlert, matchesAlertLanding } from './matchesTabAlert';
import type { ConversationSummary } from './social';

const conv = (overrides: Partial<ConversationSummary>): ConversationSummary => ({
  matchId: 'm1',
  userId: 'u1',
  firstName: 'Jordan',
  age: 27,
  photoPath: null,
  city: null,
  matchedAt: '2026-01-01',
  lastMessageBody: 'hi',
  lastMessageKind: 'text',
  lastMessageAt: '2026-01-01',
  lastMessageIsMine: false,
  muted: false,
  unreadCount: 0,
  closed: false,
  ...overrides,
});

describe('hasMatchesTabAlert', () => {
  it('is true when there is an incoming match request', () => {
    expect(hasMatchesTabAlert([{ userId: 'u2' }], [])).toBe(true);
  });

  it('is true when a chat has unread peer messages', () => {
    expect(hasMatchesTabAlert([], [conv({ unreadCount: 2 })])).toBe(true);
  });

  it('is false when the only unread state is your own last message (server returns 0)', () => {
    expect(hasMatchesTabAlert([], [conv({ unreadCount: 0, lastMessageIsMine: true })])).toBe(false);
  });
});

describe('matchesAlertLanding', () => {
  it('opens Chats when a peer message is unread', () => {
    expect(matchesAlertLanding([], [conv({ unreadCount: 1 })])).toBe('chats');
  });

  it('opens Incoming when the only new item is a match request', () => {
    expect(matchesAlertLanding([{ userId: 'u2' }], [])).toBe('incoming');
  });

  it('opens Chats when both a request and an unread message are waiting', () => {
    expect(matchesAlertLanding([{ userId: 'u2' }], [conv({ unreadCount: 1 })])).toBe('chats');
  });

  it('does not pick a segment when the heart is not lit', () => {
    expect(matchesAlertLanding([], [conv({ unreadCount: 0 })])).toBeNull();
  });
});
