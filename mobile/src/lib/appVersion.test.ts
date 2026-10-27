const constants = {
  expoConfig: { version: '1.0.0' } as { version: string } | null,
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

jest.mock('./canRegisterForRemotePush', () => ({
  isExpoGo: jest.fn(() => false),
}));

import { isExpoGo } from './canRegisterForRemotePush';
import { formatAppVersionLabel } from './appVersion';

const mockIsExpoGo = isExpoGo as jest.MockedFunction<typeof isExpoGo>;

describe('formatAppVersionLabel', () => {
  beforeEach(() => {
    constants.expoConfig = { version: '1.0.0' };
    mockIsExpoGo.mockReturnValue(false);
    application.nativeApplicationVersion = '1.0.0';
    application.nativeBuildVersion = '14';
  });

  it('combines marketing version and native build number on a packaged build', () => {
    expect(formatAppVersionLabel()).toBe('Version 1.0.0 (14)');
  });

  it('omits the build number in Expo Go', () => {
    mockIsExpoGo.mockReturnValue(true);
    application.nativeBuildVersion = '1017700';
    expect(formatAppVersionLabel()).toBe('Version 1.0.0');
  });
});
