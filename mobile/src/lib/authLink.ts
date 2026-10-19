export type AuthLink = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** 'reset' when the link came from Forgot Password. */
  next: string | null;
  error: string | null;
};

type ParamBag = Record<string, string | string[] | undefined>;

/** Single Expo Router search param (string or string[]). */
export function routeParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return '';
}

function firstParam(params: ParamBag, key: string): string | null {
  const value = routeParam(params[key]);
  return value || null;
}

/** Expo Router often passes the code as a route param on Android instead of a full URL string. */
export function parseAuthLinkFromParams(params: ParamBag): AuthLink | null {
  const code = firstParam(params, 'code');
  const accessToken = firstParam(params, 'access_token');
  const refreshToken = firstParam(params, 'refresh_token');
  const next = firstParam(params, 'next');
  const error = firstParam(params, 'error_description') ?? firstParam(params, 'error');
  if (!code && !accessToken && !error) return null;
  return { code, accessToken, refreshToken, next, error };
}

/** Prefer the full URL when present; otherwise read what the router put in the address bar. */
export function resolveAuthLink(url: string | null | undefined, params: ParamBag): AuthLink | null {
  if (url) {
    const parsed = parseAuthLink(url);
    if (parsed.code || parsed.accessToken || parsed.error) return parsed;
  }
  return parseAuthLinkFromParams(params);
}

/** Reads the parts of a sign-in link (email confirmation or password reset) the app needs. */
export function parseAuthLink(url: string): AuthLink {
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const q = new URLSearchParams(query);
  const h = new URLSearchParams(hash);
  const get = (k: string) => q.get(k) ?? h.get(k);
  return {
    code: get('code'),
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    next: get('next'),
    error: get('error_description') ?? get('error'),
  };
}
