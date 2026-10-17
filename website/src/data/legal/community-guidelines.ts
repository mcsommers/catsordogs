import type { LegalDocument } from './types';

export const communityGuidelines: LegalDocument = {
  title: 'Community Guidelines',
  metaDescription:
    'Standards for respectful, authentic behavior on Cats or Dogs?, including reporting and enforcement.',
  lastUpdated: 'October 17, 2026',
  intro:
    'Cats or Dogs? works when people show up honestly and treat each other with respect. These guidelines apply to video answers, profiles, messages, and any other use of the service. They work together with our Terms of Service and Privacy Policy.',
  sections: [
    {
      title: 'Be real',
      paragraphs: [
        'Answer the daily question yourself, on camera, in your own words. Do not use stock footage, heavy filters that hide who you are, or recordings meant to deceive others about your identity or intentions.',
        'Keep profile information truthful. Misleading age, location, or identity undermines trust and may result in removal.',
      ],
    },
    {
      title: 'Be respectful',
      paragraphs: ['Treat others the way you want to be treated in the feed, in matches, and in chat:'],
      bullets: [
        'No harassment, bullying, slurs, or targeted hate toward protected groups.',
        'No threats, coercion, or encouragement of self-harm or violence.',
        'No sexual content involving minors, non-consensual imagery, or exploitation.',
        'No spam, scams, or requests for money or sensitive financial information.',
      ],
    },
    {
      title: 'Keep it appropriate',
      paragraphs: [
        'Daily answers are short and public to the feed audience. Avoid nudity, graphic violence, and illegal activity. Captions and speech should follow the same standards as your video.',
      ],
    },
    {
      title: 'Privacy and safety',
      paragraphs: [
        'Do not share private information about others (addresses, workplace details, contact info) without consent. Do not attempt to discover or reveal who follows someone; the app is designed not to expose follower identities.',
        'If someone makes you uncomfortable, use Report or Block. For urgent danger, contact local emergency services.',
      ],
    },
    {
      title: 'Reporting',
      paragraphs: [
        'Use Report from the feed or a profile when content or behavior violates these guidelines. You can choose Report Only or Report & Block. You stay in control of that choice.',
        'Reports are reviewed using a mix of community signals and human review. Enough distinct reports on a video can hide that answer from other people\'s feeds while your account stays active. You may receive a notice with a link to Help & Support.',
      ],
    },
    {
      title: 'Enforcement',
      paragraphs: [
        'We focus on the specific content that breaks the rules: a flagged video can be hidden without disabling your whole account. Serious or repeated violations, illegal conduct, or safety risks can lead to stronger action, including account termination.',
        'Decisions are applied consistently. Attempts to evade enforcement (new accounts, ban evasion) are not allowed.',
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        'We may update these guidelines as the product evolves. The current version is always posted on this page.',
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        'Questions or appeals: catsordogsapp+support@gmail.com. In the app, open Profile → Help & Support when available.',
      ],
    },
  ],
};
