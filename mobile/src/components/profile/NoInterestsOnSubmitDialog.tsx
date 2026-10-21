import { Info } from 'lucide-react-native';
import { Dialog } from '../ui';

export const NO_INTERESTS_SUBMIT_TITLE = 'No interests?';
export const NO_INTERESTS_SUBMIT_BODY =
  'You are more likely to find matches if you specify at least one interest.';
export const NO_INTERESTS_GO_BACK = 'Go back and add interests';
export const NO_INTERESTS_PROCEED = 'Proceed without interests';

export function NoInterestsOnSubmitDialog({
  visible,
  onGoBack,
  onProceed,
}: {
  visible: boolean;
  onGoBack: () => void;
  onProceed: () => void;
}) {
  return (
    <Dialog
      visible={visible}
      variant="light"
      hero={{ type: 'icon', icon: Info, iconTone: 'warning' }}
      title={NO_INTERESTS_SUBMIT_TITLE}
      body={NO_INTERESTS_SUBMIT_BODY}
      primary={{ label: NO_INTERESTS_GO_BACK, onPress: onGoBack }}
      secondary={{ label: NO_INTERESTS_PROCEED, onPress: onProceed }}
    />
  );
}
