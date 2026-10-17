import { Trash2 } from 'lucide-react-native';
import { showConfirmation } from '../ConfirmationProvider';
import type { DialogBadgeKind } from '../ui';
import { acceptMatchDialogBody, followDialogBody, nudgeDialogBody, pronouns } from './socialCopy';

type Person = { firstName: string; gender?: string | null; avatarUri?: string | null };

function personConfirm(
  person: Person,
  badge: DialogBadgeKind,
  opts: {
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  }
) {
  showConfirmation({
    ...opts,
    avatarUri: person.avatarUri,
    avatarName: person.firstName,
    badge,
  });
}

/** Dark in-app dialog after a report is filed (06ga). Not a system alert. */
export function showReportResult(person: Person, title: string, body: string) {
  showConfirmation({
    title,
    body,
    confirmLabel: 'OK',
    cancelLabel: null,
    avatarUri: person.avatarUri,
    avatarName: person.firstName,
    badge: 'flag',
    onConfirm: () => {},
  });
}

export function confirmFollow(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'follow', {
    title: `Follow ${person.firstName}?`,
    body: followDialogBody(person.gender),
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Follow',
    onConfirm,
  });
}

export function confirmUnfollow(person: Person, onConfirm: () => void | Promise<void>) {
  const p = pronouns(person.gender);
  personConfirm(person, 'unfollow', {
    title: `Unfollow ${person.firstName}?`,
    body: `${person.firstName} won't be notified. ${p.Possessive} answers will no longer show up at the top of your feed, and you won't be able to nudge ${p.object}.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Unfollow',
    onConfirm,
  });
}

export function confirmNotInterested(person: Person, following: boolean, onConfirm: () => void | Promise<void>) {
  const p = pronouns(person.gender);
  const title = `Hide ${person.firstName}?`;
  const body = following
    ? `You won't see ${person.firstName} in your feed anymore, and you'll unfollow ${p.object}. ${p.Subject} won't be notified.`
    : `You won't see ${person.firstName} in your feed anymore. ${p.Subject} won't be notified.`;
  personConfirm(person, 'hide', {
    title,
    body,
    cancelLabel: 'Cancel',
    confirmLabel: following ? 'Yes, Hide and Unfollow' : 'Yes, Hide',
    onConfirm,
  });
}

function confirmReportChoice(
  person: Person,
  title: string,
  subject: 'response' | 'profile' | 'message',
  onReport: () => void | Promise<void>,
  onReportAndBlock: () => void | Promise<void>,
) {
  const noun = subject === 'response' ? 'response' : subject === 'profile' ? 'profile' : 'message';
  showConfirmation({
    title,
    body: `We'll review this ${noun} for violations of our community guidelines. Report Only: ${person.firstName} won't be notified. Report & Block: you won't see each other again, and ${person.firstName} won't be notified.`,
    confirmLabel: 'Report Only',
    alternateLabel: 'Report & Block',
    cancelLabel: 'Cancel',
    avatarUri: person.avatarUri,
    avatarName: person.firstName,
    badge: 'flag',
    onConfirm: onReport,
    onAlternate: onReportAndBlock,
  });
}

export function confirmFlagAnswer(
  person: Person,
  onReport: () => void | Promise<void>,
  onReportAndBlock: () => void | Promise<void>,
) {
  confirmReportChoice(person, `Report ${person.firstName}'s answer?`, 'response', onReport, onReportAndBlock);
}

export function confirmReportProfile(
  person: Person,
  onReport: () => void | Promise<void>,
  onReportAndBlock: () => void | Promise<void>,
) {
  confirmReportChoice(person, `Report ${person.firstName}?`, 'profile', onReport, onReportAndBlock);
}

export function confirmReportMessage(
  person: Person,
  onReport: () => void | Promise<void>,
  onReportAndBlock: () => void | Promise<void>,
) {
  confirmReportChoice(person, 'Report this message?', 'message', onReport, onReportAndBlock);
}

export function confirmBlock(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'block', {
    title: `Block ${person.firstName}?`,
    body: `You won't see each other again, and any match will be removed. You and ${person.firstName} won't be able to message each other.`,
    cancelLabel: 'Cancel',
    confirmLabel: `Block ${person.firstName}`,
    destructive: true,
    onConfirm,
  });
}

export function confirmSendMatch(person: Person, onConfirm: () => void | Promise<void>) {
  const p = pronouns(person.gender);
  personConfirm(person, 'heart', {
    title: `Match with ${person.firstName}?`,
    body: `${person.firstName} will be notified that you matched ${p.object}. If ${p.subject} ${p.matches} you back, you'll be able to chat.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Match',
    onConfirm,
  });
}

export function confirmCancelMatch(person: Person, onConfirm: () => void | Promise<void>) {
  const p = pronouns(person.gender);
  personConfirm(person, 'heart', {
    title: `Cancel your request to ${person.firstName}?`,
    body: `${p.Subject} won't know you sent one. You can always like one of ${p.possessive} answers again later.`,
    cancelLabel: 'Keep Request',
    confirmLabel: 'Cancel Request',
    destructive: true,
    onConfirm,
  });
}

export function confirmDeclineMatch(person: Person, onConfirm: () => void | Promise<void>) {
  const p = pronouns(person.gender);
  personConfirm(person, 'heart', {
    title: `Decline ${person.firstName}'s request?`,
    body: `${p.Subject} won't be notified. You can still like ${p.possessive} answer again later from the feed.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Decline',
    destructive: true,
    onConfirm,
  });
}

/** 07h — confirm before accepting an incoming match on the sender's profile. */
export function confirmAcceptMatch(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'heart', {
    title: `Accept ${person.firstName}'s request?`,
    body: acceptMatchDialogBody(person.firstName),
    cancelLabel: 'Cancel',
    confirmLabel: 'Accept',
    onConfirm,
  });
}

export function confirmNudge(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'follow', {
    title: `Nudge ${person.firstName}?`,
    body: nudgeDialogBody(person.gender),
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Nudge',
    onConfirm,
  });
}

export function confirmUnblock(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'unblock', {
    title: `Unblock ${person.firstName}?`,
    body: `${person.firstName} will be able to see you and message you again, and you'll see their answers in your feed. Your old match won't come back. They won't be notified.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Unblock',
    onConfirm,
  });
}

export function confirmMuteChat(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'mute', {
    title: `Mute ${person.firstName}?`,
    body: `You won't be notified about new messages from ${person.firstName} until you turn this back on.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Mute',
    onConfirm,
  });
}

export function confirmUnmatch(
  person: Person,
  onUnmatch: () => void | Promise<void>,
  onUnmatchAndBlock: () => void | Promise<void>,
) {
  showConfirmation({
    title: `Unmatch ${person.firstName}?`,
    body: `You'll lose this chat. Unmatch Only: ${person.firstName} will see that you unmatched and can no longer chat. Unmatch & Block: you won't see each other again, and ${person.firstName} won't be notified.`,
    confirmLabel: 'Unmatch Only',
    alternateLabel: 'Unmatch & Block',
    cancelLabel: 'Keep Match',
    avatarUri: person.avatarUri,
    avatarName: person.firstName,
    badge: 'unmatch',
    onConfirm: onUnmatch,
    onAlternate: onUnmatchAndBlock,
  });
}

export function confirmDeleteAccount(onConfirm: () => void | Promise<void>) {
  showConfirmation({
    title: 'Delete your account?',
    body: 'This permanently deletes your profile, photos, videos, chats, and matches. There is no undo.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Delete Account',
    destructive: true,
    variant: 'dark',
    avatarName: '',
    badge: 'block',
    useIconHero: true,
    onConfirm,
  });
}

/** 06kc / 06kd — delete one of your own videos. `isToday` adds the feed-lock warning. */
export function confirmDeleteVideo(isToday: boolean, onConfirm: () => void | Promise<void>) {
  showConfirmation({
    title: 'Delete this video?',
    body: isToday
      ? "This permanently deletes your answer to today's question, including its video and captions. Your feed will lock until you record a new answer. There is no undo."
      : 'This permanently deletes your answer to this question, including its video and captions. There is no undo.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Delete Video',
    destructive: true,
    variant: 'dark',
    avatarName: '',
    badge: 'block',
    useIconHero: true,
    icon: Trash2,
    iconTone: 'danger',
    onConfirm,
  });
}
