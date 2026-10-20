jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
  nativeAppVersion: '1.0.0',
  nativeBuildVersion: '3',
}));

import { formatAppVersionLabel } from './appVersion';

describe('formatAppVersionLabel', () => {
  it('combines marketing version and native build number', () => {
    expect(formatAppVersionLabel()).toBe('Version 1.0.0 (3)');
  });
});
