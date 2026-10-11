import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { getGate, getProfileCompleted } from '../lib/api';
import { startRoute } from '../lib/routing';
import { CenteredSpinner, PrimaryButton, styles } from '../components/ui';

/** Decides where the app opens: Welcome, Build Profile, Today's Question, or the Feed. */
export default function Start() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setFailed(false);
      if (!session) {
        router.replace('/welcome');
        return;
      }
      try {
        const profileCompleted = await getProfileCompleted(session.user.id);
        const gate = profileCompleted ? (await getGate()).state : null;
        if (!cancelled) router.replace(startRoute({ signedIn: true, profileCompleted, gate }));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loading, attempt]);

  if (failed) {
    return (
      <View style={[styles.flex, styles.center, { padding: 32, gap: 20 }]}>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          We couldn&apos;t reach the server. Check your connection and try again.
        </Text>
        <PrimaryButton label="Try Again" onPress={() => setAttempt((n) => n + 1)} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }
  return <CenteredSpinner />;
}
