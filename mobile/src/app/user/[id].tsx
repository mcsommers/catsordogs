import { useLocalSearchParams } from 'expo-router';
import { ProfileView } from '../../components/profile/ProfileView';

/** Another person's profile (06j / 06n / 07h). */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id} showBack />;
}
