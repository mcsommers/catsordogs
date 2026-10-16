import { TriangleAlert } from 'lucide-react-native';
import {
  DISCARD_FEED_SETTINGS_BODY,
  DISCARD_FEED_SETTINGS_KEEP,
  DISCARD_FEED_SETTINGS_LEAVE,
  DISCARD_FEED_SETTINGS_TITLE,
} from '../lib/feedSettingsDirty';
import { Dialog } from './ui';

export function DiscardFeedSettingsChangesDialog({
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
      title={DISCARD_FEED_SETTINGS_TITLE}
      body={DISCARD_FEED_SETTINGS_BODY}
      primary={{ label: DISCARD_FEED_SETTINGS_LEAVE, onPress: onLeave }}
      secondary={{ label: DISCARD_FEED_SETTINGS_KEEP, onPress: onKeepEditing }}
    />
  );
}
