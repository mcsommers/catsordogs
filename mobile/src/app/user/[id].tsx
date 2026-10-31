import { useLocalSearchParams } from 'expo-router';
import { firstRouteParam } from '../../lib/notificationNavigation';
import { ProfileView } from '../../components/profile/ProfileView';

/** Another person's profile (06j / 06n / 07h). */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return <ProfileView userId={firstRouteParam(id)} showBack />;
}
