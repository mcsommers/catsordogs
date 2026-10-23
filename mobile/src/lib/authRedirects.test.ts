import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import {
  AUTH_CALLBACK_HTTPS,
  confirmationRedirect,
  expoGoLinkingOrigin,
  resetRedirect,
} from './authRedirects';
import { isExpoGo } from './canRegisterForRemotePush';

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string, opts?: { queryParams?: Record<string, string> }) => {
    const base = `exp://test/--/${path}`;
    if (!opts?.queryParams) return base;
    const q = new URLSearchParams(opts.queryParams).toString();
    return q ? `${base}?${q}` : base;
  }),
}));

jest.mock('./canRegisterForRemotePush', () => ({
  isExpoGo: jest.fn(),
}));

const mockIsExpoGo = isExpoGo as jest.MockedFunction<typeof isExpoGo>;

describe('authRedirects', () => {
  const original = {
    linkingUri: Constants.linkingUri,
    experienceUrl: Constants.experienceUrl,
    hostUri: Constants.expoConfig?.hostUri,
  };

  afterEach(() => {
    mockIsExpoGo.mockReset();
    (Constants as { linkingUri?: string }).linkingUri = original.linkingUri;
    (Constants as { experienceUrl?: string }).experienceUrl = original.experienceUrl;
    if (Constants.expoConfig) Constants.expoConfig.hostUri = original.hostUri;
    jest.mocked(Linking.createURL).mockImplementation((path: string, opts?: { queryParams?: Record<string, string> }) => {
      const base = `exp://test/--/${path}`;
      if (!opts?.queryParams) return base;
      const q = new URLSearchParams(opts.queryParams).toString();
      return q ? `${base}?${q}` : base;
    });
  });

  it('uses HTTPS callback on installed builds', () => {
    mockIsExpoGo.mockReturnValue(false);
    expect(confirmationRedirect()).toBe(AUTH_CALLBACK_HTTPS);
    expect(resetRedirect()).toBe(`${AUTH_CALLBACK_HTTPS}?next=reset`);
  });

  it('uses Expo Go deep link in Expo Go', () => {
    mockIsExpoGo.mockReturnValue(true);
    (Constants as { linkingUri?: string }).linkingUri = 'exp://tunnel.trycloudflare.com/--/';
    expect(confirmationRedirect()).toBe('exp://tunnel.trycloudflare.com/--/auth-callback');
    expect(resetRedirect()).toBe('exp://tunnel.trycloudflare.com/--/auth-callback?next=reset');
  });

  it('prefers tunnel origin when createURL returns catsordogs://', () => {
    mockIsExpoGo.mockReturnValue(true);
    (Constants as { linkingUri?: string }).linkingUri = 'exp://tunnel.trycloudflare.com/--/';
    jest.mocked(Linking.createURL).mockReturnValue('catsordogs://auth-callback');
    expect(confirmationRedirect()).toBe('exp://tunnel.trycloudflare.com/--/auth-callback');
  });

  it('falls back to HTTPS in Expo Go when no exp origin is available', () => {
    mockIsExpoGo.mockReturnValue(true);
    (Constants as { linkingUri?: string }).linkingUri = 'catsordogs://';
    (Constants as { experienceUrl?: string }).experienceUrl = 'catsordogs://expo-go';
    if (Constants.expoConfig) Constants.expoConfig.hostUri = undefined;
    jest.mocked(Linking.createURL).mockReturnValue('catsordogs://auth-callback');
    expect(confirmationRedirect()).toBe(AUTH_CALLBACK_HTTPS);
  });

  it('parses hostUri without scheme', () => {
    (Constants as { linkingUri?: string }).linkingUri = '';
    (Constants as { experienceUrl?: string }).experienceUrl = '';
    if (Constants.expoConfig) Constants.expoConfig.hostUri = 'tunnel.trycloudflare.com';
    expect(expoGoLinkingOrigin()).toBe('exp://tunnel.trycloudflare.com');
  });
});
