import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appDeepLink,
  notificationSettingsAppUrl,
  openAppUrlForNotification,
} from '../../functions/_shared/emailLinks.ts';

test('notification email deep links', () => {
  assert.equal(openAppUrlForNotification('daily_question', {}), 'catsordogs://feed');
  assert.equal(openAppUrlForNotification('nudges', {}), 'catsordogs://feed');
  assert.equal(
    openAppUrlForNotification('matches', {}),
    'catsordogs://matches?segment=incoming',
  );
  assert.equal(
    openAppUrlForNotification('messages', { match_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
    'catsordogs://chat/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  );
  assert.equal(notificationSettingsAppUrl(), 'catsordogs://notifications');
  assert.equal(appDeepLink('/feed'), 'catsordogs://feed');
});
