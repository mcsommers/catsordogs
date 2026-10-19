import { Info } from 'lucide-react-native';
import { Dialog } from '../ui';

export const INTERESTS_LIMIT_TITLE = 'Interest limit';
export const INTERESTS_LIMIT_BODY = 'You can only specify 5 interests.';
export const INTERESTS_LIMIT_OK = 'OK';

export function InterestsLimitDialog({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <Dialog
      visible={visible}
      variant="light"
      hero={{ type: 'icon', icon: Info, iconTone: 'warning' }}
      title={INTERESTS_LIMIT_TITLE}
      body={INTERESTS_LIMIT_BODY}
      primary={{ label: INTERESTS_LIMIT_OK, onPress: onDismiss }}
    />
  );
}
