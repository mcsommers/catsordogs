import Constants, { AppOwnership } from 'expo-constants';
import {
  canRegisterForRemotePush,
  canUseExpoNotificationsModule,
  isExpoGo,
} from './canRegisterForRemotePush';

describe('canRegisterForRemotePush', () => {
  const original = {
    appOwnership: Constants.appOwnership,
    expoGoConfig: Constants.expoGoConfig,
  };

  afterEach(() => {
    (Constants as { appOwnership?: string }).appOwnership = original.appOwnership;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = original.expoGoConfig;
  });

  it('detects Expo Go via appOwnership', () => {
    (Constants as { appOwnership?: string }).appOwnership = AppOwnership.Expo;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = null;
    expect(isExpoGo()).toBe(true);
    expect(canUseExpoNotificationsModule()).toBe(false);
    expect(canRegisterForRemotePush()).toBe(false);
  });

  it('detects Expo Go via expoGoConfig', () => {
    (Constants as { appOwnership?: string | null }).appOwnership = null;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = { debuggerHost: 'x' };
    expect(isExpoGo()).toBe(true);
    expect(canUseExpoNotificationsModule()).toBe(false);
  });
});
