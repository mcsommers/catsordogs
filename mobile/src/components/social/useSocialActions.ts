import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { FeedMatchState } from '../../lib/feed';
import {
  blockUser,
  cancelMatchRequest,
  flagAnswer,
  followUser,
  markNotInterested,
  reportProfile,
  sendMatchRequest,
  unfollowUser,
} from '../../lib/social';
import type { MoreMenuAction } from './MoreOptionsMenu';
import {
  confirmBlock,
  confirmCancelMatch,
  confirmFlagAnswer,
  confirmFollow,
  confirmNotInterested,
  confirmReportProfile,
  confirmSendMatch,
  confirmUnfollow,
} from './confirmations';

export type SocialSubject = {
  userId: string;
  firstName: string;
  gender?: string | null;
  avatarUri?: string | null;
  isFollowed: boolean;
  matchState: FeedMatchState;
  answerId?: string | null;
  /** Flag uses answer on feed/answer; profile uses report_profile. */
  surface: 'feed' | 'profile' | 'answer';
};

type Options = {
  onStateChange?: (patch: Partial<Pick<SocialSubject, 'isFollowed' | 'matchState'>>) => void;
  onBlocked?: () => void;
  onNotInterested?: () => void;
  onMatchSent?: (result: 'sent' | 'matched') => void;
  onMatchCancelled?: () => void;
};

export function useSocialActions(subject: SocialSubject | null, options: Options = {}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const person = subject
    ? { firstName: subject.firstName, gender: subject.gender, avatarUri: subject.avatarUri }
    : { firstName: '', gender: null as string | null, avatarUri: null as string | null };

  const runMenuAction = useCallback(
    async (action: MoreMenuAction) => {
      if (!subject || action === 'cancel') return;
      try {
        if (action === 'follow') {
          confirmFollow(person, async () => {
            await followUser(subject.userId);
            options.onStateChange?.({ isFollowed: true });
          });
          return;
        }
        if (action === 'unfollow') {
          confirmUnfollow(person, async () => {
            await unfollowUser(subject.userId);
            options.onStateChange?.({ isFollowed: false });
          });
          return;
        }
        if (action === 'not_interested') {
          confirmNotInterested(person, subject.isFollowed, async () => {
            await markNotInterested(subject.userId);
            options.onNotInterested?.();
          });
          return;
        }
        if (action === 'report') {
          if (subject.surface === 'profile') {
            confirmReportProfile(person, async () => {
              const result = await reportProfile(subject.userId);
              if (result === 'already_reported') {
                Alert.alert('Already reported', 'You have already reported this profile.');
              } else {
                Alert.alert('Report submitted', "Thanks — we'll review this profile.");
              }
            });
          } else if (subject.answerId) {
            confirmFlagAnswer(person, async () => {
              const result = await flagAnswer(subject.answerId!);
              if (result === 'already_flagged') {
                Alert.alert('Already reported', 'You have already reported this answer.');
              } else {
                Alert.alert('Report submitted', "Thanks — we'll review this response.");
              }
            });
          }
          return;
        }
        if (action === 'block') {
          confirmBlock(person, async () => {
            await blockUser(subject.userId);
            options.onBlocked?.();
          });
        }
      } catch (e) {
        Alert.alert('Something went wrong', (e as Error).message || 'Please try again.');
      }
    },
    [subject, person, options]
  );

  const onHeartPress = useCallback(() => {
    if (!subject) return;
    if (subject.matchState === 'matched') return;
    if (subject.matchState === 'sent') {
      confirmCancelMatch(person, async () => {
        try {
          await cancelMatchRequest(subject.userId);
          options.onStateChange?.({ matchState: 'none' });
          options.onMatchCancelled?.();
        } catch (e) {
          Alert.alert('Something went wrong', (e as Error).message || 'Please try again.');
        }
      });
      return;
    }
    confirmSendMatch(person, async () => {
      try {
        const result = await sendMatchRequest(subject.userId, subject.surface === 'profile' ? null : subject.answerId ?? null);
        const next: FeedMatchState = result === 'matched' ? 'matched' : 'sent';
        options.onStateChange?.({ matchState: next });
        options.onMatchSent?.(result === 'matched' ? 'matched' : 'sent');
      } catch (e) {
        Alert.alert('Something went wrong', (e as Error).message || 'Please try again.');
      }
    });
  }, [subject, person, options]);

  return {
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
    runMenuAction,
    onHeartPress,
  };
}
