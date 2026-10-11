import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { Screen, TextLink, styles } from '../../components/ui';
import { colors } from '../../theme';

/** Placeholder until the Profile screens (08) are built in Phase C. */
export default function Profile() {
  const { session } = useSession();
  return (
    <Screen edges={['top']}>
      <View style={[styles.flex, styles.center, { gap: 16, paddingBottom: 96 }]}>
        <User size={34} color={colors.accentDog} />
        <Text style={styles.title}>Profile</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          Your profile and answers will show up here.{'\n'}Signed in as {session?.user.email}
        </Text>
        <TextLink label="Log Out" onPress={() => supabase.auth.signOut().then(() => router.replace('/welcome'))} />
      </View>
    </Screen>
  );
}
