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
  afterEach(() => {
    mockIsExpoGo.mockReset();
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
    expect(Linking.createURL).toHaveBeenCalledWith('auth-callback', { scheme: 'exp' });
    expect(Linking.createURL).toHaveBeenCalledWith('auth-callback', {
      scheme: 'exp',
      queryParams: { next: 'reset' },
    });
  });
});
