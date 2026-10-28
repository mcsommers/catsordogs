const constants = {
  expoConfig: { version: '1.0.0' } as { version: string } | null,
  executionEnvironment: 'standalone',
};

const application = {
  nativeApplicationVersion: '1.0.0' as string | null,
  nativeBuildVersion: '14' as string | null,
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
    constants.executionEnvironment = 'standalone';
    application.nativeApplicationVersion = '1.0.0';
    application.nativeBuildVersion = '14';
  });

  it('combines marketing version and native build number on a packaged build', () => {
    expect(formatAppVersionLabel()).toBe('Version 1.0.0 (14)');
  });

  it('omits the build number in Expo Go', () => {
    constants.executionEnvironment = 'storeClient';
    application.nativeBuildVersion = '1017700';
    expect(formatAppVersionLabel()).toBe('Version 1.0.0');
  });

  it('shows Android versionCode on an installed Play build', () => {
    application.nativeBuildVersion = '3';
    expect(formatAppVersionLabel()).toBe('Version 1.0.0 (3)');
  });
});
