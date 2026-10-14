import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import {
  profileHasUnsavedChanges,
  snapshotProfileForm,
  snapshotProfilePhotos,
  type ProfileDraft,
  type ProfilePhotoDraft,
} from '../lib/profileDirty';

type Baseline = { form: string; photos: string };

export function useProfileLeaveGuard({
  ready,
  form,
  photos,
  onLeave,
}: {
  ready: boolean;
  form: ProfileDraft;
  photos: ProfilePhotoDraft[];
  onLeave: () => void;
}) {
  const navigation = useNavigation();
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [discardVisible, setDiscardVisible] = useState(false);
  const allowLeaveRef = useRef(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!ready || baseline) return;
    setBaseline({ form: snapshotProfileForm(form), photos: snapshotProfilePhotos(photos) });
  }, [ready, baseline, form, photos]);

  const dirty = profileHasUnsavedChanges(form, photos, baseline);

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

  const syncBaseline = useCallback(() => {
    setBaseline({ form: snapshotProfileForm(form), photos: snapshotProfilePhotos(photos) });
  }, [form, photos]);

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
      event.preventDefault();
      if (!discardVisible) queueLeave();
    });
    return unsubscribe;
  }, [dirty, discardVisible, navigation, queueLeave]);

  const leaveNow = useCallback(() => {
    allowLeaveRef.current = true;
    onLeave();
  }, [onLeave]);

  /** After a successful save — allows router navigation without the discard dialog. */
  const permitSavedNavigation = useCallback(() => {
    allowLeaveRef.current = true;
    setBaseline({ form: snapshotProfileForm(form), photos: snapshotProfilePhotos(photos) });
  }, [form, photos]);

  return {
    dirty,
    discardVisible,
    attemptLeave,
    confirmLeave,
    keepEditing,
    leaveNow,
    permitSavedNavigation,
    syncBaseline,
  };
}
