import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../theme';
import { formatAppVersionLabel } from '../../lib/appVersion';
import { profileType } from './profileTypography';

const ROWS: { label: string; route?: string }[] = [
  { label: 'Edit Profile', route: '/edit-profile' },
  { label: 'Feed Settings', route: '/feed-settings' },
  { label: 'Notifications', route: '/notifications' },
  { label: 'Privacy & Safety', route: '/privacy-safety' },
  { label: 'People I follow', route: '/people-i-follow' },
  { label: 'Blocked and Not Interested', route: '/blocked-list' },
  { label: 'Help & Support' },
];

type Props = { onLogOut: () => void };

/** 08 Account section rows + Log Out. */
export function ProfileAccountSection({ onLogOut }: Props) {
  const { session } = useSession();
  const signedInEmail = session?.user.email?.trim() ?? '';
  const versionLabel = formatAppVersionLabel();
  const [helpUrl, setHelpUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.rpc('get_app_config');
        const url = (data ?? [])[0]?.help_support_url;
        setHelpUrl(url ? String(url) : null);
      } catch {
        /* help URL optional */
      }
    })();
  }, []);

  const onRow = (label: string, route?: string) => {
    if (route) {
      router.push(route as '/edit-profile');
      return;
    }
    if (label === 'Help & Support') {
      if (!helpUrl) {
        Alert.alert('Help & Support', 'Help is not set up yet. Check back later.');
        return;
      }
      void Linking.openURL(helpUrl);
    }
  };

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>Account</Text>
      {ROWS.map(({ label, route }) => (
        <Pressable key={label} style={styles.row} onPress={() => onRow(label, route)}>
          <Text style={styles.rowLabel}>{label}</Text>
          <ChevronRight size={16} color={colors.textDarkFaint} />
        </Pressable>
      ))}
      {signedInEmail ? (
        <Text style={styles.signedInEmail} accessibilityLabel={`Signed in as ${signedInEmail}`}>
          {signedInEmail}
        </Text>
      ) : null}
      <View style={styles.logOutBlock}>
        <Pressable style={styles.logOutRow} onPress={onLogOut} accessibilityRole="button">
          <LogOut size={15} color="#FF5C5C" />
          <Text style={styles.logOutLabel}>Log Out</Text>
        </Pressable>
        {versionLabel ? (
          <Text style={styles.versionLabel} accessibilityLabel={versionLabel}>
            {versionLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  sectionTitle: { ...profileType.sectionTitle, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  signedInEmail: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDarkFaint,
    paddingTop: 8,
    paddingBottom: 4,
  },
  logOutBlock: { gap: 6 },
  logOutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  logOutLabel: { fontFamily: fonts.body, fontSize: 14, color: '#FF5C5C' },
  versionLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDarkFaint,
    textAlign: 'right',
    paddingBottom: 4,
  },
});
