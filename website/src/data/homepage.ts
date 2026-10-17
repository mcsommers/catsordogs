export const siteName = 'Cats or Dogs?';

export const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#subscriptions', label: 'Subscriptions' },
  { href: '#safety', label: 'Safety' },
  { href: '#support', label: 'Support' },
  { href: '#download', label: 'Download' },
] as const;

export const hero = {
  headline: 'Meet people through what they actually say',
  subhead:
    'Every day, everyone answers the same question on camera. Discover real people in a feed built on honesty, not curated photos.',
};

export const howItWorks = {
  title: 'How it works',
  subtitle:
    'One daily question. Real video answers. Relationships that start with voice and face, not filters.',
  steps: [
    {
      title: 'Get today’s question',
      body:
        "Everyone sees the same prompt each calendar day, whether it's timely or timeless.",
    },
    {
      title: 'Record your answer',
      body: 'Up to 14 seconds on camera. Your first answer unlocks the feed right away.',
    },
    {
      title: 'Explore the feed',
      body: 'Swipe through real responses. Follow people you want to hear from again.',
    },
    {
      title: 'Match & chat',
      body: 'Send a match request when someone’s answers resonate. Chat when you both say yes.',
    },
  ],
};

export const subscriptions = {
  title: 'Subscriptions',
  subtitle:
    "Start free. Upgrade when you're ready for more. Pricing and perks are still being finalized.",
  tiers: [
    {
      id: 'free',
      name: 'Free',
      badge: null,
      price: 'Pricing TBD',
      featured: false,
      bullets: [
        'Daily question & feed access',
        'Record and match at no cost',
        'Core safety and reporting tools',
      ],
    },
    {
      id: 'gold',
      name: 'Gold',
      badge: 'Coming soon',
      price: null,
      featured: true,
      bullets: [
        'Everything in Free',
        'Additional capabilities coming soon',
        'Placeholder benefit',
      ],
    },
    {
      id: 'platinum',
      name: 'Platinum',
      badge: 'Coming soon',
      price: null,
      featured: false,
      bullets: [
        'Everything in Gold',
        'Premium capabilities coming soon',
        'Placeholder benefit',
      ],
    },
  ],
};

export const safety = {
  title: 'Safety',
  subtitle:
    'Authenticity needs trust. We combine community reports with human review, and we disable videos, not whole accounts, when content crosses the line.',
  items: [
    {
      title: 'Report answers & profiles',
      body:
        "Use Report from the feed or a profile. Choose Report Only or Report & Block; you're always in control.",
    },
    {
      title: 'Videos reviewed, accounts stay',
      body:
        'Enough distinct flags hide that answer from feeds. You’re notified and pointed to Help & Support.',
    },
    {
      title: 'Privacy you control',
      body:
        'Turn off followers, manage blocks, and delete your account instantly from Privacy & Safety.',
    },
    {
      title: 'Community guidelines',
      body:
        'We review responses, profiles, and messages against shared standards, with the same rules for everyone.',
    },
  ],
};

export const support = {
  title: 'Support',
  subtitle: 'Quick answers while we build out the full help center.',
  faqs: [
    {
      question: 'Do I have to answer every day?',
      answer:
        'You can skip, but the feed stays locked until you record today’s answer. Matches, chats, and your profile stay available.',
    },
    {
      question: 'How long can my answer be?',
      answer:
        'Up to 14 seconds by default (in the future a paid subscription may unlock more recording time).',
    },
    {
      question: 'What happens if someone reports my video?',
      answer:
        'After enough distinct reports, that answer is hidden from other people’s feeds. Your account stays active; you’re notified and pointed to Help & Support.',
    },
    {
      question: 'Can someone see who follows them?',
      answer:
        'No. The app never reveals follower identities, only that you follow someone. You can turn off followers entirely in Privacy & Safety.',
    },
    {
      question: 'How do I get help in the app?',
      answer: 'Open Profile → Help & Support to visit our help site.',
    },
    {
      question: 'How do I delete my account?',
      answer:
        'Privacy & Safety → Delete account. This permanently removes your profile, photos, videos, chats, and matches. There is no undo.',
    },
  ],
};

export const downloadSection = {
  title: 'Download Cats or Dogs?',
  subtitle:
    'Available soon on iOS and Android. Join the daily question and meet people who show up as themselves.',
};

export const footer = {
  legalLabels: ['Privacy', 'Terms', 'Community guidelines'],
  copyright: '© 2026 Cats or Dogs? Authenticity-first dating.',
};

export const seo = {
  title: 'Cats or Dogs? | Authenticity-first dating',
  description:
    'Meet people through what they actually say. One daily question, real video answers, and a feed built on honesty, not curated photos.',
};
