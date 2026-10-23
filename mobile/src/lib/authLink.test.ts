import { parseAuthLink, parseAuthLinkFromParams, resolveAuthLink, routeParam } from './authLink';

describe('reading sign-in links', () => {
  it('reads the one-time code from an email confirmation link', () => {
    const link = parseAuthLink('catsordogs://auth-callback?code=abc123');
    expect(link.code).toBe('abc123');
    expect(link.next).toBeNull();
  });

  it('reads the code from the HTTPS app-link callback (installed build)', () => {
    const link = parseAuthLink('https://catsordogs.net/auth-callback?code=abc123');
    expect(link.code).toBe('abc123');
  });

  it('knows a password reset link (Expo Go address)', () => {
    const link = parseAuthLink('exp://192.168.1.20:8081/--/auth-callback?next=reset&code=xyz');
    expect(link).toMatchObject({ code: 'xyz', next: 'reset' });
  });

  it('reads tokens from the part after #', () => {
    const link = parseAuthLink('catsordogs://auth-callback#access_token=a&refresh_token=r');
    expect(link).toMatchObject({ accessToken: 'a', refreshToken: 'r', code: null });
  });

  it('reports an expired link', () => {
    const link = parseAuthLink('catsordogs://auth-callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    expect(link.error).toBe('Email link is invalid or has expired');
  });

  it('reads the code from Expo Router params when the URL string is missing', () => {
    const link = parseAuthLinkFromParams({ code: 'from-router' });
    expect(link).toMatchObject({ code: 'from-router', next: null });
  });

  it('prefers a full URL but falls back to route params', () => {
    expect(resolveAuthLink(null, { code: 'router' })?.code).toBe('router');
    expect(resolveAuthLink('catsordogs://auth-callback?code=url', { code: 'router' })?.code).toBe('url');
  });
});

describe('routeParam', () => {
  it('reads string or first array entry', () => {
    expect(routeParam('a@b.co')).toBe('a@b.co');
    expect(routeParam(['x@y.co', 'other'])).toBe('x@y.co');
    expect(routeParam(undefined)).toBe('');
  });
});
