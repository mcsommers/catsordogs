import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ensureForegroundNotificationHandler } from './notificationHandler';
import { canRegisterForRemotePush, registerForPushNotifications } from './push';
import { navigateFromNotificationPayload } from './notificationNavigation';
import { runNavigationAction } from './deferredNavigation';
import { useSession } from './session';

function pathFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    let path = parsed.path?.replace(/^\//, '') ?? '';
    if (parsed.hostname && parsed.hostname !== 'catsordogs.net') {
      // Custom scheme: catsordogs://user/uuid
    } else if (parsed.hostname === 'catsordogs.net' && path) {
      path = path.replace(/^\//, '');
    }
    if (!path || path === 'open-app' || path === 'open-app.html') return null;
    if (path === 'question' || path === 'matches') return `/${path}`;
    if (path.startsWith('chat/')) return `/${path}`;
    if (path.startsWith('user/')) return `/${path}`;
    const deep = url.match(/\/(user|chat)\/[0-9a-f-]{36}/i);
    if (deep) return deep[0];
    return null;
  } catch {
    return null;
  }
}

/** Register push when signed in; handle notification taps and https app links. */
export function usePushAndNotificationLinks() {
  const { session, loading } = useSession();
  const router = useRouter();
  const handledColdStartNotificationId = useRef<string | null>(null);

  useEffect(() => {
    if (!canRegisterForRemotePush()) return;
    ensureForegroundNotificationHandler();
  }, []);

  useEffect(() => {
    if (loading || !session) return;
    registerForPushNotifications().catch(() => {});
  }, [loading, session?.user.id]);

  useEffect(() => {
    if (loading || !session) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') registerForPushNotifications().catch(() => {});
    });
    return () => sub.remove();
  }, [loading, session?.user.id]);

  useEffect(() => {
    if (loading || !session) return;

    const openPath = (href: string) => {
      runNavigationAction(() => {
        router.push(href as `/question`);
      });
    };

    const handleUrl = (url: string | null) => {
      if (!url) return;
      const href = pathFromUrl(url);
      if (href) openPath(href);
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [loading, session?.user.id, router]);

  useEffect(() => {
    if (loading || !session || !canRegisterForRemotePush()) return;
    let remove: (() => void) | undefined;

    (async () => {
      const Notifications = await import('expo-notifications');
      const open = (response: {
        notification: { request: { identifier: string; content: { data: Record<string, unknown> } } };
      }) => {
        runNavigationAction(() => {
          navigateFromNotificationPayload(router, response.notification.request.content.data);
        });
      };
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        const id = last.notification.request.identifier;
        if (handledColdStartNotificationId.current !== id) {
          handledColdStartNotificationId.current = id;
          open(last);
        }
      }
      remove = Notifications.addNotificationResponseReceivedListener((e) => open(e)).remove;
    })();

    return () => remove?.();
  }, [loading, session?.user.id, router]);
}
