const DEFAULT_WEBSITE_ORIGIN = 'https://catsordogs.net';

type LegalUrlEnv = {
  websiteOrigin: string | undefined;
};

const defaultEnv: LegalUrlEnv = {
  websiteOrigin: process.env.EXPO_PUBLIC_WEBSITE_URL,
};

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error('EXPO_PUBLIC_WEBSITE_URL must start with https://');
  }
  return trimmed;
}

export function getWebsiteOrigin(env: LegalUrlEnv = defaultEnv): string {
  const raw = env.websiteOrigin?.trim();
  if (!raw) return DEFAULT_WEBSITE_ORIGIN;
  return normalizeOrigin(raw);
}

export function termsOfServiceUrl(env?: LegalUrlEnv): string {
  return `${getWebsiteOrigin(env)}/terms-of-service`;
}

export function privacyPolicyUrl(env?: LegalUrlEnv): string {
  return `${getWebsiteOrigin(env)}/privacy-policy`;
}
