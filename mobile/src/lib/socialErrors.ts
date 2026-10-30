import { Alert } from 'react-native';

type RpcError = { message?: string };

/** User-facing text from a Supabase RPC error or thrown Error. */
export function rpcErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    const msg = error.message.trim();
    return msg || null;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as RpcError).message ?? '').trim();
    return msg || null;
  }
  return null;
}

export function alertSocialActionError(error: unknown): void {
  const message = rpcErrorMessage(error);
  Alert.alert(message ? 'Could not complete' : 'Something went wrong', message ?? 'Please try again.');
}
