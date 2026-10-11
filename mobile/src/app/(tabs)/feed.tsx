import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Clapperboard } from 'lucide-react-native';
import { getGate, type Gate } from '../../lib/api';
import { FeedLocked, NoQuestionToday } from '../../components/QuestionStates';
import { CenteredSpinner, PrimaryButton, Screen } from '../../components/ui';
import { colors, fonts } from '../../theme';

/**
 * The Feed tab. Until today's answer is in it shows Feed Locked (06m), or No
 * Question Today (04g). The video feed itself is built in Phase B.
 */
export default function Feed() {
  const [gate, setGate] = useState<Gate | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const g = await getGate();
      if (g.state === 'profile_incomplete') return router.replace('/build-profile');
      setGate(g);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (failed) {
    return (
      <Screen dark edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.body}>We couldn&apos;t reach the server. Check your connection and try again.</Text>
          <PrimaryButton label="Try Again" onPress={load} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }
  if (!gate) return <CenteredSpinner dark />;

  return (
    <Screen dark edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 96 }}>
        {gate.state === 'no_question_today' ? (
          <NoQuestionToday
            checking={checking}
            onCheckAgain={async () => {
              setChecking(true);
              await load();
              setChecking(false);
            }}
          />
        ) : gate.state === 'not_answered' ? (
          <FeedLocked question={gate.questionText ?? ''} onAnswer={() => router.push('/question')} />
        ) : (
          <View style={styles.center}>
            <Clapperboard size={34} color={colors.accentDog} />
            <Text style={styles.heading}>You&apos;re in for today</Text>
            <Text style={styles.body}>The video feed arrives in the next build. Your answer is live.</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 12 },
  heading: { fontFamily: fonts.heading, fontSize: 26, color: colors.white, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted, textAlign: 'center' },
});
