import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { canRegisterForRemotePush, canUseExpoNotificationsModule } from './canRegisterForRemotePush';
import { ensureForegroundNotificationHandler } from './notificationHandler';
import { registerForPushNotifications } from './push';
import { navigateFromNotificationPayload, pathFromNotificationUrl, pushAppPath } from './notificationNavigation';
import { runNavigationAction } from './deferredNavigation';
import { useSession } from './session';

/** Register push when signed in; handle notification taps and https app links. */
export function usePushAndNotificationLinks() {
  const { session, loading } = useSession();
  const router = useRouter();
  const handledColdStartNotificationId = useRef<string | null>(null);

  useEffect(() => {
    if (!canUseExpoNotificationsModule()) return;
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
        pushAppPath(router, href);
      });
    };

    const handleUrl = (url: string | null) => {
      if (!url) return;
      const href = pathFromNotificationUrl(url);
      if (href) openPath(href);
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [loading, session?.user.id, router]);

  useEffect(() => {
    if (loading || !session || !canUseExpoNotificationsModule()) return;
    let remove: (() => void) | undefined;

    (async () => {
      const Notifications = await import('expo-notifications');
      const open = (response: import('expo-notifications').NotificationResponse) => {
        const data = response.notification.request.content.data;
        runNavigationAction(() => {
          navigateFromNotificationPayload(router, data ? { ...data } : undefined);
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
