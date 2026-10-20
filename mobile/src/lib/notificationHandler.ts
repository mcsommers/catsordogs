import * as Notifications from 'expo-notifications';
import { canRegisterForRemotePush } from './push';

let installed = false;

/** Must run before any remote notification arrives while the app is open. */
export function ensureForegroundNotificationHandler(): void {
  if (installed || !canRegisterForRemotePush()) return;
  installed = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

ensureForegroundNotificationHandler();
