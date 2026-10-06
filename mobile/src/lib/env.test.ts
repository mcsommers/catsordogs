import { getSupabaseConfig } from './env';

describe('getSupabaseConfig', () => {
  it('throws a helpful error when settings are missing', () => {
    expect(() => getSupabaseConfig({ url: undefined, anonKey: undefined })).toThrow(
      /Missing EXPO_PUBLIC_SUPABASE_URL/
    );
  });

  it('returns the settings when present', () => {
    expect(getSupabaseConfig({ url: 'http://localhost:54321', anonKey: 'test-key' })).toEqual({
      url: 'http://localhost:54321',
      anonKey: 'test-key',
    });
  });
});
