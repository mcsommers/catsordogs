import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { colors, fonts } from '../../theme';
import { profileType } from './profileTypography';
import { showPhaseDPlaceholder } from './phaseDPlaceholder';

const ROWS = [
  'Edit Profile',
  'Feed Settings',
  'Notifications',
  'Privacy & Safety',
  'Blocked and Not Interested',
  'Help & Support',
] as const;

type Props = { onLogOut: () => void };

/** 08 Account section rows + Log Out. */
export function ProfileAccountSection({ onLogOut }: Props) {
  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>Account</Text>
      {ROWS.map((label) => (
        <Pressable key={label} style={styles.row} onPress={() => showPhaseDPlaceholder(label)}>
          <Text style={styles.rowLabel}>{label}</Text>
          <ChevronRight size={16} color={colors.textDarkFaint} />
        </Pressable>
      ))}
      <Pressable style={styles.logOutRow} onPress={onLogOut} accessibilityRole="button">
        <LogOut size={15} color="#FF5C5C" />
        <Text style={styles.logOutLabel}>Log Out</Text>
      </Pressable>
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
  logOutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  logOutLabel: { fontFamily: fonts.body, fontSize: 14, color: '#FF5C5C' },
});
