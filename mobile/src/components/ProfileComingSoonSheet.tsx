import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { User } from 'lucide-react-native';
import { PrimaryButton } from './ui';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  name: string | null;
  onClose: () => void;
};

export function ProfileComingSoonSheet({ visible, name, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.iconWrap}>
          <User size={28} color={colors.accentDog} />
        </View>
        <Text style={styles.title}>Profile coming soon</Text>
        <Text style={styles.body}>
          {name ? `Full profiles for ${name} arrive in the next update.` : 'Full profiles arrive in the next update.'} You can keep browsing the feed for now.
        </Text>
        <PrimaryButton label="Got it" onPress={onClose} style={{ alignSelf: 'stretch' }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 14,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.textPrimary, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
});
