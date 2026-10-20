import { getLocalActiveChatMatchId } from './activeChatPresence';
import { canRegisterForRemotePush } from './push';

let installed = false;

function shouldSuppressForegroundNotification(
  data: Record<string, unknown> | undefined,
): boolean {
  if (!data || data.kind !== 'message') return false;
  const matchId = data.match_id;
  if (typeof matchId !== 'string' || !matchId) return false;
  return matchId === getLocalActiveChatMatchId();
}

/** Must run before any remote notification arrives while the app is open. No-op in Expo Go (SDK 53+). */
export function ensureForegroundNotificationHandler(): void {
  if (installed || !canRegisterForRemotePush()) return;
  installed = true;
  void (async () => {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        const suppress = shouldSuppressForegroundNotification(data);
        return {
          shouldShowBanner: !suppress,
          shouldShowList: !suppress,
          shouldPlaySound: !suppress,
          shouldSetBadge: false,
        };
      },
    });
  })();
}
