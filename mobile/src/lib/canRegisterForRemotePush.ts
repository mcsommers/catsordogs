import { Platform } from 'react-native';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';

/**
 * True when running inside Expo Go (not a TestFlight / Play / store build).
 * Do not treat `expoGoConfig != null` as Expo Go: SDK 58 store builds expose the
 * embedded app config there, so that check skipped push on installed binaries.
 */
export function isExpoGo(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return true;
  if (Constants.appOwnership === AppOwnership.Expo) return true;
  return false;
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
