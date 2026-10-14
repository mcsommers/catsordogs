import { TriangleAlert } from 'lucide-react-native';
import {
  DISCARD_PROFILE_BODY,
  DISCARD_PROFILE_KEEP,
  DISCARD_PROFILE_LEAVE,
  DISCARD_PROFILE_TITLE,
} from '../../lib/profileDirty';
import { Dialog } from '../ui';

export function DiscardProfileChangesDialog({
  visible,
  onKeepEditing,
  onLeave,
}: {
  visible: boolean;
  onKeepEditing: () => void;
  onLeave: () => void;
}) {
  return (
    <Dialog
      visible={visible}
      variant="light"
      hero={{ type: 'icon', icon: TriangleAlert, iconTone: 'warning' }}
      title={DISCARD_PROFILE_TITLE}
      body={DISCARD_PROFILE_BODY}
      primary={{ label: DISCARD_PROFILE_LEAVE, onPress: onLeave }}
      secondary={{ label: DISCARD_PROFILE_KEEP, onPress: onKeepEditing }}
    />
  );
}
