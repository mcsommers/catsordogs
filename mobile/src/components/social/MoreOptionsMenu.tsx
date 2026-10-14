import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

export type MoreMenuAction = 'follow' | 'unfollow' | 'not_interested' | 'report' | 'block' | 'cancel';

type Props = {
  visible: boolean;
  isFollowed: boolean;
  onSelect: (action: MoreMenuAction) => void;
  onDismiss: () => void;
};

const OPTIONS: { key: MoreMenuAction; label: string; destructive?: boolean }[] = [
  { key: 'follow', label: 'Follow' },
  { key: 'not_interested', label: 'Not Interested' },
  { key: 'report', label: 'Report' },
  { key: 'block', label: 'Block', destructive: true },
  { key: 'cancel', label: 'Cancel' },
];

/** 06e / 06p / 06k more-options sheet — order matches MVP. */
export function MoreOptionsMenu({ visible, isFollowed, onSelect, onDismiss }: Props) {
  const rows = OPTIONS.map((o) =>
    o.key === 'follow' ? { ...o, key: isFollowed ? ('unfollow' as const) : ('follow' as const), label: isFollowed ? 'Unfollow' : 'Follow' } : o
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={styles.sheet}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              style={styles.row}
              onPress={() => {
                onDismiss();
                onSelect(row.key);
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.rowLabel, row.destructive && styles.destructive]}>{row.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceDark,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  destructive: { color: '#FF5C5C' },
});
