import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { resolveAuthLink } from '../lib/authLink';
import { CenteredSpinner, PrimaryButton, styles } from '../components/ui';

const WAIT_FOR_LINK_MS = 8000;

/**
 * Email confirmation and password reset links open the app here. The link's
 * one-time code signs the person in on this phone, then they continue to
 * Build Profile or Set New Password.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams();
  const linkingUrl = Linking.useLinkingURL();
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => setInitialUrl(url));
  }, []);

  const url = linkingUrl ?? initialUrl;

  useEffect(() => {
    let cancelled = false;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const link = resolveAuthLink(url, params);
      if (!link) {
        waitTimer = setTimeout(() => {
          if (!cancelled) {
            setProblem(
              'We couldn\u2019t read this link. Open it on the same phone you signed up on, or ask for a new confirmation email.'
            );
          }
        }, WAIT_FOR_LINK_MS);
        return;
      }
      if (link.error) {
        return setProblem('This link has expired or was already used. Ask for a new one.');
      }

      let error: { message: string } | null = null;
      if (link.code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(link.code));
      } else if (link.accessToken && link.refreshToken) {
        ({ error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken }));
      } else {
        error = { message: 'missing code' };
      }
      if (cancelled) return;
      if (error) {
        return setProblem(
          'We couldn\u2019t sign you in with this link. Open it on the same phone you signed up on, or ask for a new one.'
        );
      }
      router.replace(link.next === 'reset' ? '/set-new-password' : '/build-profile');
    })();

    return () => {
      cancelled = true;
      if (waitTimer) clearTimeout(waitTimer);
    };
  }, [url, params.code, params.next, params.access_token, params.refresh_token, params.error, params.error_description]);

  if (!problem) return <CenteredSpinner />;
  return (
    <View style={[styles.flex, styles.center, { padding: 32, gap: 20 }]}>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>{problem}</Text>
      <PrimaryButton label="Back to Log In" onPress={() => router.replace('/log-in')} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
