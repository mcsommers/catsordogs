import { showConfirmation } from '../ConfirmationProvider';
import type { DialogBadgeKind } from '../ui';
import { capitalize, objectPronoun, possessivePronoun, subjectPronoun } from './socialCopy';

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

export function confirmFollow(person: Person, onConfirm: () => void | Promise<void>) {
  const subj = capitalize(subjectPronoun(person.gender));
  const obj = objectPronoun(person.gender);
  personConfirm(person, 'follow', {
    title: `Follow ${person.firstName}?`,
    body: `${subj} won't know you're following ${obj}. ${possessivePronoun(person.gender).charAt(0).toUpperCase()}${possessivePronoun(person.gender).slice(1)} answer will show up at the top of your feed every day ${subj} posts.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Follow',
    onConfirm,
  });
}

export function confirmUnfollow(person: Person, onConfirm: () => void | Promise<void>) {
  const subj = capitalize(subjectPronoun(person.gender));
  const obj = objectPronoun(person.gender);
  personConfirm(person, 'unfollow', {
    title: `Unfollow ${person.firstName}?`,
    body: `${person.firstName} won't be notified. ${possessivePronoun(person.gender).charAt(0).toUpperCase()}${possessivePronoun(person.gender).slice(1)} answers will no longer show up at the top of your feed, and you won't be able to nudge ${obj}.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Unfollow',
    onConfirm,
  });
}

export function confirmNotInterested(person: Person, following: boolean, onConfirm: () => void | Promise<void>) {
  const title = `Hide ${person.firstName}?`;
  const body = following
    ? `You won't see ${person.firstName} in your feed anymore, and you'll unfollow them. They won't be notified.`
    : `You won't see ${person.firstName} in your feed anymore. They won't be notified.`;
  personConfirm(person, 'hide', {
    title,
    body,
    cancelLabel: 'Cancel',
    confirmLabel: following ? 'Yes, Hide and Unfollow' : 'Yes, Hide',
    onConfirm,
  });
}

export function confirmFlagAnswer(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'flag', {
    title: `Report ${person.firstName}'s answer?`,
    body: `We'll review this response for violations of our community guidelines. ${person.firstName} won't be notified.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Submit Report',
    destructive: true,
    onConfirm,
  });
}

export function confirmReportProfile(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'flag', {
    title: `Report ${person.firstName}?`,
    body: `We'll review this profile for violations of our community guidelines. ${person.firstName} won't be notified.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Submit Report',
    destructive: true,
    onConfirm,
  });
}

export function confirmReportMessage(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'flag', {
    title: 'Report this message?',
    body: `We'll review this message for violations of our community guidelines. ${person.firstName} won't be notified.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Submit Report',
    destructive: true,
    onConfirm,
  });
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
  personConfirm(person, 'heart', {
    title: `Match with ${person.firstName}?`,
    body: `${person.firstName} will be notified. You can chat only if you both match.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Match',
    onConfirm,
  });
}

export function confirmCancelMatch(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'heart', {
    title: `Cancel your request to ${person.firstName}?`,
    body: `They won't know you sent one. You can always like one of their answers again later.`,
    cancelLabel: 'Keep Request',
    confirmLabel: 'Cancel Request',
    destructive: true,
    onConfirm,
  });
}

export function confirmDeclineMatch(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'heart', {
    title: `Decline ${person.firstName}'s request?`,
    body: `They won't be notified. You can still like their answer again later from the feed.`,
    cancelLabel: 'Cancel',
    confirmLabel: 'Decline',
    destructive: true,
    onConfirm,
  });
}

export function confirmNudge(person: Person, onConfirm: () => void | Promise<void>) {
  const subj = subjectPronoun(person.gender);
  const obj = capitalize(subj);
  personConfirm(person, 'follow', {
    title: `Nudge ${person.firstName}?`,
    body: `${obj}'ll be told that a follower wants to hear ${possessivePronoun(person.gender)} answer to today's question. ${obj} won't know who. You can nudge ${objectPronoun(person.gender)} once a day.`,
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

export function confirmUnmatch(person: Person, onConfirm: () => void | Promise<void>) {
  personConfirm(person, 'unmatch', {
    title: `Unmatch ${person.firstName}?`,
    body: `You'll lose this chat. ${person.firstName} won't be notified. You can match again later.`,
    cancelLabel: 'Keep Match',
    confirmLabel: 'Unmatch',
    destructive: true,
    onConfirm,
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
