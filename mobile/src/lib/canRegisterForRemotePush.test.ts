import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import {
  canRegisterForRemotePush,
  canUseExpoNotificationsModule,
  isExpoGo,
} from './canRegisterForRemotePush';

describe('canRegisterForRemotePush', () => {
  const original = {
    appOwnership: Constants.appOwnership,
    executionEnvironment: Constants.executionEnvironment,
    expoGoConfig: Constants.expoGoConfig,
  };

  afterEach(() => {
    (Constants as { appOwnership?: string | null }).appOwnership = original.appOwnership;
    (Constants as { executionEnvironment?: string }).executionEnvironment = original.executionEnvironment;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = original.expoGoConfig;
  });

  it('detects Expo Go via appOwnership', () => {
    (Constants as { appOwnership?: string }).appOwnership = AppOwnership.Expo;
    (Constants as { executionEnvironment?: string }).executionEnvironment = ExecutionEnvironment.Standalone;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = null;
    expect(isExpoGo()).toBe(true);
    expect(canUseExpoNotificationsModule()).toBe(false);
    expect(canRegisterForRemotePush()).toBe(false);
  });

  it('detects Expo Go via StoreClient execution environment', () => {
    (Constants as { appOwnership?: string | null }).appOwnership = null;
    (Constants as { executionEnvironment?: string }).executionEnvironment = ExecutionEnvironment.StoreClient;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = null;
    expect(isExpoGo()).toBe(true);
    expect(canUseExpoNotificationsModule()).toBe(false);
    expect(canRegisterForRemotePush()).toBe(false);
  });

  it('treats store builds as not Expo Go even when expoGoConfig is present', () => {
    (Constants as { appOwnership?: string | null }).appOwnership = null;
    (Constants as { executionEnvironment?: string }).executionEnvironment = ExecutionEnvironment.Standalone;
    (Constants as { expoGoConfig?: unknown }).expoGoConfig = { name: 'Cats or Dogs?' };
    expect(isExpoGo()).toBe(false);
    expect(canUseExpoNotificationsModule()).toBe(true);
    expect(canRegisterForRemotePush()).toBe(true);
  });
});
