import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { AUTH_CALLBACK_HTTPS, confirmationRedirect, resetRedirect } from './authRedirects';
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
  const originalLinkingUri = Constants.linkingUri;

  afterEach(() => {
    mockIsExpoGo.mockReset();
    (Constants as { linkingUri?: string }).linkingUri = originalLinkingUri;
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
    expect(confirmationRedirect()).toBe('exp://test/--/auth-callback');
    expect(resetRedirect()).toBe('exp://test/--/auth-callback?next=reset');
  });

  it('rebuilds when createURL returns catsordogs://', () => {
    mockIsExpoGo.mockReturnValue(true);
    (Constants as { linkingUri?: string }).linkingUri = 'exp://tunnel.trycloudflare.com/--/';
    jest.mocked(Linking.createURL).mockReturnValue('catsordogs://auth-callback');
    expect(confirmationRedirect()).toBe('exp://tunnel.trycloudflare.com/--/auth-callback');
  });

  it('rebuilds broken exp://auth-callback (no dev host)', () => {
    mockIsExpoGo.mockReturnValue(true);
    (Constants as { linkingUri?: string }).linkingUri = 'exp://tunnel.trycloudflare.com/--/';
    jest.mocked(Linking.createURL).mockReturnValue('exp://auth-callback');
    expect(confirmationRedirect()).toBe('exp://tunnel.trycloudflare.com/--/auth-callback');
  });
});
