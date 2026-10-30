import { useCallback, useState } from 'react';
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
import { alertSocialActionError } from '../../lib/socialErrors';
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
  showReportResult,
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
  onStateChange?: (
    userId: string,
    patch: Partial<Pick<SocialSubject, 'isFollowed' | 'matchState'>>,
  ) => void;
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
            options.onStateChange?.(subject.userId, { isFollowed: true });
          });
          return;
        }
        if (action === 'unfollow') {
          confirmUnfollow(person, async () => {
            await unfollowUser(subject.userId);
            options.onStateChange?.(subject.userId, { isFollowed: false });
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
          const tell = (result: string, already: string, thanks: string) => {
            if (result === 'already_reported' || result === 'already_flagged') {
              showReportResult(person, 'Already reported', already);
            } else {
              showReportResult(person, 'Report submitted', thanks);
            }
          };
          if (subject.surface === 'profile') {
            confirmReportProfile(
              person,
              async () => {
                const result = await reportProfile(subject.userId);
                tell(result, 'You have already reported this profile.', "Thanks. We'll review this profile.");
              },
              async () => {
                const result = await reportProfile(subject.userId);
                await blockUser(subject.userId);
                options.onBlocked?.();
                tell(
                  result,
                  "You have already reported this profile. You won't see each other again.",
                  "Thanks. We'll review this profile. You won't see each other again.",
                );
              },
            );
          } else if (subject.answerId) {
            confirmFlagAnswer(
              person,
              async () => {
                const result = await flagAnswer(subject.answerId!);
                tell(result, 'You have already reported this answer.', "Thanks. We'll review this response.");
              },
              async () => {
                const result = await flagAnswer(subject.answerId!);
                await blockUser(subject.userId);
                options.onBlocked?.();
                tell(
                  result,
                  "You have already reported this answer. You won't see each other again.",
                  "Thanks. We'll review this response. You won't see each other again.",
                );
              },
            );
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
        alertSocialActionError(e);
      }
    },
    [subject, person, options]
  );

  const onHeartPress = useCallback(() => {
    if (!subject) return;
    if (subject.matchState === 'matched') return;
    if (subject.matchState === 'sent') {
      confirmCancelMatch(person, async () => {
        await cancelMatchRequest(subject.userId);
        options.onStateChange?.(subject.userId, { matchState: 'none' });
        options.onMatchCancelled?.();
      });
      return;
    }
    confirmSendMatch(person, async () => {
      const result = await sendMatchRequest(subject.userId, subject.surface === 'profile' ? null : subject.answerId ?? null);
      const next: FeedMatchState = result === 'matched' ? 'matched' : 'sent';
      options.onStateChange?.(subject.userId, { matchState: next });
      options.onMatchSent?.(result === 'matched' ? 'matched' : 'sent');
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
