import type { LegalDocument } from './types';

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  metaDescription:
    'How Cats or Dogs? collects, uses, and protects your information when you use our app and website.',
  lastUpdated: 'October 17, 2026',
  intro:
    'Cats or Dogs? ("we," "us," or "our") operates the Cats or Dogs? mobile app and catsordogs.net. This Privacy Policy explains what we collect, how we use it, and the choices you have. By using our services, you agree to this policy.',
  sections: [
    {
      title: 'Information we collect',
      paragraphs: ['We collect information in these ways:'],
      bullets: [
        'Account information you provide, such as email, password, profile details, photos, and preferences.',
        'Daily video answers you record, including audio, video, auto-generated captions, and related metadata.',
        'Usage information, such as feed views, follows, match requests, messages, reports, and notification settings.',
        'Device and app information, such as device type, app version, and the time zone you set in the app for daily questions.',
        'Location information you choose to add to your profile (for example city or coordinates used for distance in the feed).',
        'Website launch signups: if you join our email list from the marketing site, we store the email address you submit.',
        'Communications with us, including support requests.',
      ],
    },
    {
      title: 'How we use information',
      paragraphs: [
        'We use your information to operate and improve Cats or Dogs?, including showing you the daily question, building your feed, enabling matches and chat, enforcing our Community Guidelines, and sending notifications you allow.',
        'We use moderation signals (such as community reports) and human review to keep the service safe. When content is flagged, we may hide a specific video while keeping your account active, and we may notify you with next steps.',
        'We may send service emails (for example sign-up confirmation or account notices). You can control many in-app notification types in Settings.',
      ],
    },
    {
      title: 'How we share information',
      paragraphs: [
        'We do not sell your personal information. We share information only as needed to run the service, comply with law, or protect safety:',
      ],
      bullets: [
        'Service providers that help us host data, deliver video, send email, and operate infrastructure (under contracts that limit their use of your data).',
        'Other users, as you choose through the product (for example profile fields you show, video answers in the feed, and messages with matches).',
        'We do not show other users who follows them; follower identities are not disclosed through the app.',
        'Authorities or others when required by law or to protect rights, safety, and integrity of the service.',
      ],
    },
    {
      title: 'Video and media',
      paragraphs: [
        'Your recordings are processed to play in the app, generate captions, and apply safety review. Video files are stored with our video hosting partners. When you delete your account, we delete profile content, videos, chats, and matches as described in the app.',
      ],
    },
    {
      title: 'Retention',
      paragraphs: [
        'We keep your information while your account is active and as needed to provide the service. If you delete your account, we remove your profile, photos, videos, chats, and matches. Some moderation records may be retained in anonymized form so we can show that a report was handled, consistent with our product rules and legal obligations.',
      ],
    },
    {
      title: 'Your choices',
      paragraphs: ['You can:'],
      bullets: [
        'Update profile and notification settings in the app.',
        'Turn off followers in Privacy & Safety.',
        'Block or report other users from the feed or a profile.',
        'Delete your account at any time from Privacy & Safety (permanent, with no undo).',
        'Unsubscribe from marketing emails using the link in those messages, if we send them.',
      ],
    },
    {
      title: 'Security',
      paragraphs: [
        'We use technical and organizational measures designed to protect your information. No method of transmission or storage is completely secure.',
      ],
    },
    {
      title: 'Children',
      paragraphs: [
        'Cats or Dogs? is for adults. You must be at least 18 years old to use the app. We do not knowingly collect information from anyone under 18.',
      ],
    },
    {
      title: 'International users',
      paragraphs: [
        'If you use the service from outside the United States, your information may be processed in the United States or other countries where we or our providers operate.',
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        'We may update this Privacy Policy from time to time. We will post the new version on this page and update the "Last updated" date. Continued use after changes means you accept the updated policy.',
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        'Questions about privacy: catsordogsapp+privacy@gmail.com.',
      ],
    },
  ],
};
