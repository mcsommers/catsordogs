import {
  followDialogBody,
  acceptMatchDialogBody,
  incomingMatchCardBody,
  matchRequestCardTitle,
  newMatchChatIntro,
  unmatchedChatNotice,
  nudgeCardBody,
  nudgeCardTitle,
  nudgeDialogBody,
  pronouns,
} from './socialCopy';

describe('confirmation pronouns', () => {
  it('uses she/her for Woman', () => {
    const p = pronouns('Woman');
    expect(p.Subject).toBe('She');
    expect(p.object).toBe('her');
    expect(p.possessive).toBe('her');
    expect(p.matches).toBe('matches');
  });

  it('uses he/him for Man', () => {
    const p = pronouns('Man');
    expect(p.Subject).toBe('He');
    expect(p.object).toBe('him');
    expect(p.possessive).toBe('his');
    expect(p.matches).toBe('matches');
  });

  it('uses they/them for More genders or missing gender', () => {
    expect(pronouns('Non-binary').Subject).toBe('They');
    expect(pronouns('Non-binary').object).toBe('them');
    expect(pronouns('Non-binary').matches).toBe('match');
    expect(pronouns(null).Subject).toBe('They');
    expect(pronouns(undefined).object).toBe('them');
  });

  it('keeps mid-sentence follow pronouns lowercase', () => {
    expect(followDialogBody('Man')).toBe(
      "He won't know you're following him. His answer will show up at the top of your feed every day he posts.\n\nFollowing is not matching, and they do not need to follow you back."
    );
    expect(followDialogBody('Woman')).toBe(
      "She won't know you're following her. Her answer will show up at the top of your feed every day she posts.\n\nFollowing is not matching, and they do not need to follow you back."
    );
  });

  it('formats nudge card copy (06n)', () => {
    expect(nudgeCardTitle('Jordan')).toBe("Jordan hasn't answered today yet");
    expect(nudgeCardBody('Man')).toBe(
      "Give him a nudge. He'll only be told that a follower wants to hear his answer, never who."
    );
    expect(nudgeCardBody('Woman')).toBe(
      "Give her a nudge. She'll only be told that a follower wants to hear her answer, never who."
    );
    expect(nudgeCardBody('Non-binary')).toBe(
      "Give them a nudge. They'll only be told that a follower wants to hear their answer, never who."
    );
  });

  it('formats incoming match card copy (07h)', () => {
    expect(matchRequestCardTitle('Sam')).toBe('Match with Sam?');
    expect(incomingMatchCardBody('Coffee or tea', '2h ago')).toBe(
      'Liked your answer to Coffee or tea · 2h ago'
    );
    expect(incomingMatchCardBody(null, '5h ago')).toBe('Wants to match with you · 5h ago');
    expect(acceptMatchDialogBody('Alex')).toBe(
      "You'll be matched with Alex and can chat with each other right away."
    );
    expect(newMatchChatIntro('Alex')).toBe(
      'You and Alex are now matched. You can chat with each other now.'
    );
    expect(unmatchedChatNotice('Alex')).toBe('Alex unmatched you. You can no longer chat.');
  });

  it('formats nudge confirmation copy (06o)', () => {
    expect(nudgeDialogBody('Man')).toBe(
      "He'll be told that a follower wants to hear his answer to today's question. He won't know who. You can nudge him once a day."
    );
  });
});
