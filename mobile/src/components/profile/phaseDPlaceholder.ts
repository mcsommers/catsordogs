import { Alert } from 'react-native';

export function showPhaseDPlaceholder(label: string) {
  Alert.alert('Coming in the next update', `${label} arrives in the next update.`);
}

export function showMatchingPlaceholder() {
  Alert.alert('Coming soon', 'Matching arrives in the next update.');
}

export function showMoreOptionsPlaceholder() {
  Alert.alert('Coming soon', 'More options arrives in the next update.');
}
