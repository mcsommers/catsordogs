import { getWebsiteOrigin, privacyPolicyUrl, termsOfServiceUrl } from './legalUrls';

describe('legalUrls', () => {
  it('defaults to the production marketing site', () => {
    expect(getWebsiteOrigin({ websiteOrigin: undefined })).toBe('https://catsordogs.net');
    expect(termsOfServiceUrl({ websiteOrigin: undefined })).toBe(
      'https://catsordogs.net/terms-of-service'
    );
    expect(privacyPolicyUrl({ websiteOrigin: undefined })).toBe('https://catsordogs.net/privacy-policy');
  });

  it('strips trailing slashes from a custom origin', () => {
    expect(termsOfServiceUrl({ websiteOrigin: 'https://catsordogs.net/' })).toBe(
      'https://catsordogs.net/terms-of-service'
    );
  });

  it('rejects non-https origins', () => {
    expect(() => getWebsiteOrigin({ websiteOrigin: 'http://catsordogs.net' })).toThrow(/https/);
  });
});
