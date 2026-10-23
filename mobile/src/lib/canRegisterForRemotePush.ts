import { Platform } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';

/** True when running inside the Expo Go app (not a dev client or store build). */
export function isExpoGo(): boolean {
  if (Constants.appOwnership === AppOwnership.Expo) return true;
  // SDK 58+ may omit appOwnership; Expo Go always sets expoGoConfig.
  return Constants.expoGoConfig != null;
}

/**
 * Whether it is safe to `import('expo-notifications')`.
 * On Android Expo Go (SDK 53+), the package throws (missing ExpoTopicSubscriptionModule).
 */
export function canUseExpoNotificationsModule(): boolean {
  if (Platform.OS === 'web') return false;
  return !isExpoGo();
}

/** Remote push tokens are not available in Expo Go. Use a development build to test push. */
export function canRegisterForRemotePush(): boolean {
  if (Platform.OS === 'web') return false;
  return !isExpoGo();
}
