import { Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { colors } from '../../theme';
import { profileActionCardStyles as styles } from './profileActionCardStyles';

/** 06z — success state after sending a match from profile (same chrome as 06n Nudge Card). */
export function MatchRequestSentBanner({ firstName }: { firstName: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.infoRow}>
        <View style={styles.iconWrap}>
          <Heart size={20} color={colors.white} fill={colors.white} />
        </View>
        <Text style={[styles.title, { flex: 1 }]}>Match request sent to {firstName}</Text>
      </View>
    </View>
  );
}
