import { Pressable, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { incomingMatchCardBody, matchRequestCardTitle } from './socialCopy';
import { profileActionCardStyles as styles } from './profileActionCardStyles';

type Props = {
  firstName: string;
  questionText: string | null;
  requestedAt: string;
  onDecline: () => void;
  onAccept: () => void;
};

/** 07h — pending incoming match on the sender's profile. */
export function IncomingMatchCard({ firstName, questionText, requestedAt, onDecline, onAccept }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.infoRow}>
        <View style={styles.iconWrap}>
          <Heart size={20} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{matchRequestCardTitle(firstName)}</Text>
          <Text style={styles.body}>{incomingMatchCardBody(questionText, requestedAt)}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnOutline]}
          onPress={onDecline}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnLabel}>Decline</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={onAccept}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnLabel}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}
