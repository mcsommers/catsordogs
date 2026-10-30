import { rpcErrorMessage } from './socialErrors';

describe('rpcErrorMessage', () => {
  it('reads Supabase-style errors', () => {
    expect(
      rpcErrorMessage({ code: '23514', message: 'This person is not accepting followers.' }),
    ).toBe('This person is not accepting followers.');
  });

  it('reads Error instances', () => {
    expect(rpcErrorMessage(new Error('Network request failed'))).toBe('Network request failed');
  });

  it('returns null for unknown values', () => {
    expect(rpcErrorMessage(null)).toBeNull();
  });
});
