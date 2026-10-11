import { Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Screen, styles } from '../../components/ui';
import { colors } from '../../theme';

/** Placeholder until the Matches screens (07) are built in Phase D. */
export default function Matches() {
  return (
    <Screen edges={['top']}>
      <View style={[styles.flex, styles.center, { gap: 16, paddingBottom: 96 }]}>
        <Heart size={34} color={colors.accentDog} />
        <Text style={styles.title}>Matches</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>Your matches and chats will show up here.</Text>
      </View>
    </Screen>
  );
}
