import { Info } from 'lucide-react-native';
import { Dialog } from '../ui';
import { ABOUT_FOLLOWING_BODY, ABOUT_FOLLOWING_TITLE } from './socialCopy';

export function AboutFollowingDialog({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <Dialog
      visible={visible}
      variant="dark"
      hero={{ type: 'icon', icon: Info }}
      title={ABOUT_FOLLOWING_TITLE}
      body={ABOUT_FOLLOWING_BODY}
      primary={{ label: 'OK', onPress: onDismiss }}
    />
  );
}
