import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { canRegisterForRemotePush, registerForPushNotifications } from './push';
import { navigateFromNotificationPayload } from './notificationNavigation';
import { useSession } from './session';

function pathFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path?.replace(/^\//, '') ?? '';
    if (!path) return null;
    if (path === 'question' || path === 'matches') return `/${path}`;
    if (path.startsWith('chat/')) return `/${path}`;
    if (path.startsWith('user/')) return `/${path}`;
    return null;
  } catch {
    return null;
  }
}

/** Register push when signed in; handle notification taps and https app links. */
export function usePushAndNotificationLinks() {
  const { session, loading } = useSession();
  const router = useRouter();

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
      router.push(href as `/question`);
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
    if (!canRegisterForRemotePush()) return;
    let remove: (() => void) | undefined;

    (async () => {
      const Notifications = await import('expo-notifications');
      const open = (response: { notification: { request: { content: { data: Record<string, unknown> } } } }) => {
        navigateFromNotificationPayload(router, response.notification.request.content.data);
      };
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) open(last);
      remove = Notifications.addNotificationResponseReceivedListener(open).remove;
    })();

    return () => remove?.();
  }, [router]);
}
