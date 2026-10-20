/** Turn a failed Edge Function call into text the admin UI can show. */
export async function invokeFunctionErrorMessage(
  error: { message: string; context?: Response } | null,
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (error?.context) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // Response body was not JSON.
    }
  }
  return error?.message ?? 'Something went wrong calling the server.';
}
