import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { signOutToWelcome } from '../lib/signOut';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { deleteAccountFully } from '../lib/social';
import { confirmDeleteAccount } from '../components/social/confirmations';
import { BackButton, CenteredSpinner, Screen, TextLink, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

export default function PrivacySafetyScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [allowFollowers, setAllowFollowers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('allow_followers').eq('id', userId).maybeSingle();
    if (error) throw error;
    setAllowFollowers(data?.allow_followers ?? true);
  }, [userId]);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onToggleFollowers = async (next: boolean) => {
    if (!userId) return;
    setAllowFollowers(next);
    const { error } = await supabase.from('profiles').update({ allow_followers: next }).eq('id', userId);
    if (error) {
      setAllowFollowers(!next);
      Alert.alert('Could not update', 'Try again.');
    }
  };

  const onDelete = () => {
    confirmDeleteAccount(async () => {
      setDeleting(true);
      try {
        await deleteAccountFully();
        await signOutToWelcome(router);
      } catch (e) {
        Alert.alert('Could not delete account', (e as Error).message || 'Try again.');
      } finally {
        setDeleting(false);
      }
    });
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
        <Text style={ui.headerTitleDark}>Privacy & Safety</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Allow followers</Text>
        <Text style={styles.cardBody}>
          When off, new people cannot follow you and followers cannot nudge you. Existing followers stay until you turn
          this back on.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{allowFollowers ? 'On' : 'Off'}</Text>
          <Switch
            value={allowFollowers}
            onValueChange={onToggleFollowers}
            trackColor={{ true: colors.accentDog, false: colors.borderDark }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delete account</Text>
        <Text style={styles.cardBody}>
          Permanently deletes your profile, photos, videos, chats, and matches. There is no undo.
        </Text>
        <TextLink label={deleting ? 'Deleting…' : 'Delete account'} onPress={onDelete} color="#FF5C5C" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
