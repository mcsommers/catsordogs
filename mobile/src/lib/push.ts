import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ensureForegroundNotificationHandler } from './notificationHandler';
import { registerDeviceToken } from './social';

/** Remote push tokens are not available in Expo Go (SDK 53+). Use a development build to test push. */
export function canRegisterForRemotePush(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!canRegisterForRemotePush()) return null;

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
