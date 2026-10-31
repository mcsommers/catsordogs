import { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { getGate, getProfileCompleted } from '../lib/api';
import { pathFromNotificationUrl } from '../lib/notificationNavigation';
import { startRoute, type StartRoute } from '../lib/routing';
import { CenteredSpinner, PrimaryButton, styles } from '../components/ui';

/** Decides where the app opens: Welcome, Build Profile, or the Feed (locked until today is answered). */
export default function Start() {
  const { session, loading } = useSession();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [href, setHref] = useState<StartRoute | null>(null);
  const [incomingPath, setIncomingPath] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        if (!cancelled) setIncomingPath(pathFromNotificationUrl(url));
      })
      .catch(() => {
        if (!cancelled) setIncomingPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setFailed(false);
      setHref(null);
      if (!session) {
        if (!cancelled) setHref('/welcome');
        return;
      }
      try {
        const profileCompleted = await getProfileCompleted(session.user.id);
        const gate = profileCompleted ? (await getGate()).state : null;
        if (!cancelled) setHref(startRoute({ signedIn: true, profileCompleted, gate }));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loading, attempt]);

  const openHref = href === '/feed' && incomingPath ? incomingPath : href;
  if (!loading && href && incomingPath !== undefined) return <Redirect href={openHref as Href} />;

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
