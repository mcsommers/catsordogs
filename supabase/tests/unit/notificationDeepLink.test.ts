import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationOpenPath, notificationOpenUrl } from '../../functions/_shared/notificationDeepLink.ts';

const origin = 'https://catsordogs.net';

test('notification deep links use https paths that work on any phone', () => {
  assert.equal(notificationOpenPath('daily_question', {}), '/question');
  assert.equal(notificationOpenPath('nudge', {}), '/question');
  assert.equal(
    notificationOpenUrl(origin, 'match_request', { sender_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
    `${origin}/user/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`,
  );
  assert.equal(
    notificationOpenUrl(origin, 'match', { match_id: '11111111-2222-3333-4444-555555555555' }),
    `${origin}/chat/11111111-2222-3333-4444-555555555555`,
  );
  assert.equal(
    notificationOpenUrl(origin, 'message', { match_id: '11111111-2222-3333-4444-555555555555' }),
    `${origin}/chat/11111111-2222-3333-4444-555555555555`,
  );
  assert.equal(notificationOpenUrl(origin, 'moderation', {}), null);
});
