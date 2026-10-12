import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '../../theme';
import { profileType } from './profileTypography';

export function ProfileStatBadge({ icon, label, mutedIcon }: { icon: ReactNode; label: string; mutedIcon?: boolean }) {
  return (
    <View style={styles.badge}>
      <View style={mutedIcon ? styles.iconMuted : undefined}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  iconMuted: { opacity: 0.85 },
  label: profileType.statLabel,
});
