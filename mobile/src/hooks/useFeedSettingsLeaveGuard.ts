import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';

export function useFeedSettingsLeaveGuard({
  dirty,
  onLeave,
}: {
  dirty: boolean;
  onLeave: () => void;
}) {
  const navigation = useNavigation();
  const [discardVisible, setDiscardVisible] = useState(false);
  const allowLeaveRef = useRef(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

  const queueLeave = useCallback(() => {
    pendingLeaveRef.current = () => {
      allowLeaveRef.current = true;
      onLeave();
    };
    setDiscardVisible(true);
  }, [onLeave]);

  const attemptLeave = useCallback(() => {
    if (!dirty) {
      allowLeaveRef.current = true;
      onLeave();
      return;
    }
    queueLeave();
  }, [dirty, onLeave, queueLeave]);

  const confirmLeave = useCallback(() => {
    setDiscardVisible(false);
    const leave = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    leave?.();
  }, []);

  const keepEditing = useCallback(() => {
    setDiscardVisible(false);
    pendingLeaveRef.current = null;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (discardVisible) {
          keepEditing();
          return true;
        }
        if (!dirty) return false;
        queueLeave();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [discardVisible, dirty, keepEditing, queueLeave])
  );

  useEffect(() => {
    if (!dirty) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) return;
      (event as unknown as { preventDefault: () => void }).preventDefault();
      if (!discardVisible) queueLeave();
    });
    return unsubscribe;
  }, [dirty, discardVisible, navigation, queueLeave]);

  const permitLeave = useCallback(() => {
    allowLeaveRef.current = true;
  }, []);

  return {
    discardVisible,
    attemptLeave,
    confirmLeave,
    keepEditing,
    permitLeave,
  };
}
