const constants = {
  expoConfig: { version: '1.0.0' } as { version: string } | null,
  expoVersion: null as string | null,
  appOwnership: null as string | null,
};

const application = {
  nativeApplicationVersion: '1.0.0' as string | null,
  nativeBuildVersion: '6' as string | null,
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: constants,
}));

jest.mock('expo-application', () => application);

import { formatAppVersionLabel } from './appVersion';

describe('formatAppVersionLabel', () => {
  beforeEach(() => {
    constants.expoConfig = { version: '1.0.0' };
    constants.expoVersion = null;
    constants.appOwnership = null;
    application.nativeApplicationVersion = '1.0.0';
    application.nativeBuildVersion = '6';
  });

  it('combines marketing version and native build number on a packaged build', () => {
    expect(formatAppVersionLabel()).toBe('Version 1.0.0 (6)');
  });

  it('omits the build number in Expo Go', () => {
    constants.expoVersion = '57.0.0';
    constants.appOwnership = 'expo';
    application.nativeBuildVersion = '1017700';
    expect(formatAppVersionLabel()).toBe('Version 1.0.0');
  });
});
