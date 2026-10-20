import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Remote push tokens are not available in Expo Go (SDK 53+). Use a development build to test push. */
export function canRegisterForRemotePush(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}
