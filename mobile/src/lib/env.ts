type RawEnv = {
  url: string | undefined;
  anonKey: string | undefined;
};

// Expo only injects EXPO_PUBLIC_* values when they are written out in full like this.
const defaultEnv: RawEnv = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

export function getSupabaseConfig(env: RawEnv = defaultEnv) {
  const { url, anonKey } = env;
  if (!url || !anonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile/.env.example to mobile/.env and fill them in.'
    );
  }
  return { url, anonKey };
}
