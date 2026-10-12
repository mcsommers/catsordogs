import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '../../theme';
import { profileType } from './profileTypography';

export function ProfileInfoChip({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <View style={styles.chip}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  icon: { opacity: 0.85 },
  label: profileType.chipLabel,
});
