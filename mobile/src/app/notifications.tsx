import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  getNotificationPreferences,
  setNotificationPreference,
  type NotificationPreference,
} from '../lib/social';
import { canRegisterForRemotePush } from '../lib/push';
import { BackButton, CenteredSpinner, Screen, ToggleSwitch, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

const LABELS: Record<NotificationPreference['type'], { title: string; body: string }> = {
  daily_question: { title: 'Daily question', body: "Reminders when today's question is ready." },
  matches: { title: 'Matches', body: 'New match requests and mutual matches.' },
  messages: { title: 'Messages', body: 'New chat messages from your matches.' },
  nudges: { title: 'Nudges', body: 'When followers want to hear your answer.' },
};

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setPrefs(await getNotificationPreferences());
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const toggle = async (type: NotificationPreference['type'], channel: 'push' | 'email', next: boolean) => {
    try {
      await setNotificationPreference(type, channel, next);
      setPrefs((rows) =>
        rows.map((r) =>
          r.type === type ? { ...r, [channel === 'push' ? 'pushEnabled' : 'emailEnabled']: next } : r
        )
      );
    } catch {
      Alert.alert('Could not update', 'Try again.');
    }
  };

  if (loading) {
    return (
      <Screen dark>
        <CenteredSpinner dark />
      </Screen>
    );
  }

  return (
    <Screen dark scroll edges={['top', 'bottom']}>
      <View style={ui.headerWithTitle}>
        <BackButton onPress={() => router.back()} dark />
        <Text style={ui.headerTitleDark}>Notifications</Text>
      </View>
      <Text style={styles.lead}>Choose how we reach you for each type of update.</Text>
      {!canRegisterForRemotePush() ? (
        <Text style={styles.expoGoNote}>
          Push notifications need a development build. In Expo Go you can still change these settings; push registers automatically
          after you install a TestFlight or Play build and sign in.
        </Text>
      ) : null}
      {prefs.map((row) => (
        <View key={row.type} style={styles.card}>
          <Text style={styles.cardTitle}>{LABELS[row.type].title}</Text>
          <Text style={styles.cardBody}>{LABELS[row.type].body}</Text>
          <ToggleRow label="Push" value={row.pushEnabled} onChange={(v) => toggle(row.type, 'push', v)} />
          <ToggleRow label="Email" value={row.emailEnabled} onChange={(v) => toggle(row.type, 'email', v)} />
        </View>
      ))}
    </Screen>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <ToggleSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted, marginBottom: 12 },
  expoGoNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textDarkMuted,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  cardBody: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted, lineHeight: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
});
