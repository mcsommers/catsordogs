import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  size?: 'sm' | 'md';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** Circular control on profile hero (back / more / heart), Pencil #00000066. */
export function ProfileHeroIconButton({ children, size = 'md', onPress, accessibilityLabel, style }: Props) {
  const dim = size === 'sm' ? 36 : 44;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, { width: dim, height: dim, borderRadius: dim / 2 }, style]}
      hitSlop={8}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
