import { useEffect, useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react-native';
import { Dialog, type DialogBadgeKind } from './ui';

export type ConfirmationRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  variant?: 'dark' | 'light';
  /** Profile photo URL when available; initials used as fallback. */
  avatarUri?: string | null;
  avatarName: string;
  badge: DialogBadgeKind;
  /** Account delete and other non-person confirmations keep the warning icon (08h). */
  useIconHero?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

let showConfirmationImpl: ((request: ConfirmationRequest) => void) | null = null;

/** Show the in-app confirmation dialog (Pencil 06f–06h, 06b, 06o, etc.). Requires `ConfirmationProvider` in the tree. */
export function showConfirmation(request: ConfirmationRequest) {
  showConfirmationImpl?.(request);
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  useEffect(() => {
    showConfirmationImpl = (next) => setRequest(next);
    return () => {
      showConfirmationImpl = null;
    };
  }, []);

  const dismiss = () => setRequest(null);

  const hero =
    request == null || request.useIconHero
      ? { type: 'icon' as const, icon: TriangleAlert, iconTone: 'warning' as const }
      : {
          type: 'avatar' as const,
          uri: request.avatarUri,
          name: request.avatarName,
          badge: request.badge,
        };

  return (
    <>
      {children}
      <Dialog
        visible={request != null}
        variant={request?.variant ?? 'dark'}
        hero={hero}
        title={request?.title ?? ''}
        body={request?.body ?? ''}
        primaryDestructive={request?.destructive}
        primary={{
          label: request?.confirmLabel ?? '',
          onPress: () => {
            const action = request?.onConfirm;
            dismiss();
            if (action) void action();
          },
        }}
        secondary={
          request
            ? {
                label: request.cancelLabel ?? 'Cancel',
                onPress: () => {
                  request.onCancel?.();
                  dismiss();
                },
              }
            : undefined
        }
      />
    </>
  );
}
