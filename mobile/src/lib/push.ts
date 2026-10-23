import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { canRegisterForRemotePush, canUseExpoNotificationsModule } from './canRegisterForRemotePush';
import { ensureForegroundNotificationHandler } from './notificationHandler';
import { registerDeviceToken } from './social';

export { canRegisterForRemotePush } from './canRegisterForRemotePush';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!canRegisterForRemotePush() || !canUseExpoNotificationsModule()) return null;

  try {
    ensureForegroundNotificationHandler();
    const Notifications = await import('expo-notifications');

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResult.data;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await registerDeviceToken(token, platform);
    return token;
  } catch {
    return null;
  }
}
