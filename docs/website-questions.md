# Website design — questions and decisions

Living log of product questions, options, and Mike’s answers for the public marketing site (`docs/website.pen`). Update this file as design and scope evolve.

## Copy parity (standing rule — Oct 17, 2026)

**All user-facing copy on the marketing homepage must be identical on desktop and mobile.**

- In `docs/website.pen`, the source frames are **`Homepage — Desktop`** (`IMAqz`) and **`Homepage — Mobile`** (`DTi69`). Layout may differ (nav, stacking, hamburger); **wording must not.**
- When changing headline, section titles, body copy, FAQ, tier bullets, footer, or Download text, **apply the same edit to both frames** in the same piece of work.
- After copy edits, spot-check: comparable text nodes on desktop and mobile should match (63 strings each as of Oct 17, 2026, excluding nav chrome and logo labels).
- Punctuation: follow **Product copy punctuation** in root `AGENTS.md` (no em dashes in user-facing copy).

---

## Homepage (first pass) — Oct 17, 2026

| # | Question | Options presented | Mike’s answer |
|---|----------|-------------------|---------------|
| 1 | Hero headline | **A.** “Cats or Dogs?” as main headline **B.** Lead with a transformation line; app name smaller | **B** — lead with a transformation line |
| 2 | “PICK YOUR PACK” tagline | Use on site / align screen 01 / skip | **Skip** on the website. Also update screen **01** in `docs/pencil-new.pen`: replace the hero with a screenshot of the welcome video wired in the app; remove “Pick your pack” (does not apply). |
| 3 | Primary CTA | App Store + Play badges / Download scroll / Get Started only / other | **App Store + Google Play** badge placeholders (hero and Download section) |
| 4 | Subscriptions | Placeholder tier cards vs wait for pricing | **Yes** — Free, Gold, Platinum with placeholder bullets; no prices until model is defined |
| 5 | Support section | On-page FAQ vs mostly external help link | **On-page FAQ**; populate from project docs |
| 6 | Mobile nav | Hamburger vs horizontal section links | **Hamburger menu** |
| 7 | Footer | Minimal vs legal links | **Privacy**, **Terms**, and **Community guidelines** on the homepage |
| 8 | Launch positioning | Generic national vs first-city wedge | **National / generic** |

### Defaults used where Mike did not override (recorded for traceability)

- **Visual system:** Match mobile — Anton + Funnel Sans; dark homepage using app dark tokens (`bg-dark`, `surface-dark`, dog orange accent).
- **Hero visual (website):** Full iPhone mockup image `website/assets/homepagehero.png` (470×954).
- **Structure:** Single scrolling homepage; nav items scroll to sections: How it works, Subscriptions, Safety, FAQs, Download.
- **Logo:** Simple placeholder until brand lockup exists.
- **Frames in Pencil:** Desktop (~1440px) and mobile (~390px) homepage variants.

### Design progress log

| Date | Update |
|------|--------|
| Oct 17, 2026 | Created `docs/website.pen`; captured homepage decisions above. |
| Oct 17, 2026 | **Screen 01 (`pencil-new.pen`):** Removed “PICK YOUR PACK” and cat/dog badge hero; hero is now a still from `mobile/assets/welcome-video-2b.mp4` (`docs/website-assets/welcome-hero-frame.jpg`). |
| Oct 17, 2026 | **Homepage — Desktop (`website.pen`, frame `Homepage — Desktop`):** Dark theme; nav anchors (labels only in design); hero with transformation headline + iPhone mock showing exported **06 Feed** (`F7sxPq.png`); sections How it works, Subscriptions (Free/Gold/Platinum placeholders), Safety, Support (FAQ from MVP/concept), Download (store badge placeholders), footer (Privacy, Terms, Community guidelines). |
| Oct 17, 2026 | **Homepage — Mobile (`website.pen`):** 390px-wide scroll; hamburger in nav; same sections stacked; separate frame **Mobile Nav — Menu Open** documents the expanded menu state. |
| Oct 17, 2026 | **Hero polish:** Header logo orange; removed hero “Cats or Dogs?” line and bullet differentiators; official App Store / Google Play badge artwork; iPhone hero uses `website/black.webp` frame over inset **06** feed screenshot. |
| Oct 17, 2026 | Store badges on homepage use Mike’s assets: `website/appstore.png` and `website/googleplay.png` (replacing generated badge files in `docs/website-assets/`). |
| Oct 17, 2026 | **Copy parity:** Mobile homepage copy synced to desktop (hero, all sections, full 6-item FAQ, subscriptions, Download, footer). Standing rule added above. |
| Oct 17, 2026 | Homepage copy: replaced em dashes with commas, periods, or semicolons where they read more naturally (desktop + mobile). |
| Oct 17, 2026 | Subscriptions: **Coming soon** pill labels on Gold and Platinum (desktop + mobile); Free still shows **Pricing TBD**. |
| Oct 17, 2026 | Synced mobile homepage copy from Mike’s desktop edits (hero line break, FAQ answer length, Help & Support FAQ). |
| Oct 17, 2026 | **Mobile Nav — Menu Open:** header row with **Menu** title and **Close** (X) control top-right. |
| Oct 17, 2026 | **Hero visual:** Replaced layered `black.webp` + **06 Feed** inset with single asset `website/homepagehero.png` on desktop and mobile. |
| Oct 17, 2026 | **Website assets:** Mike moved marketing assets under `website/assets/`; `website.pen` image fills updated to `../website/assets/…`. |
| Oct 17, 2026 | **Website code:** Astro static site in `website/` (run `npm run website` from repo root). Copy lives in `website/src/data/homepage.ts`. Section nav anchors wired; store badges and footer legal labels are not links yet. Set `PUBLIC_SITE_URL` in `website/.env` before production build for canonical URLs, sitemap, and Open Graph. |
| Oct 17, 2026 | **Download modal:** Store badges open a Coming Soon dialog with email notify signup. Design frame **Download Modal** in `website.pen`. Backend: `website_launch_signups` + RPC `submit_website_launch_notify` (migration `20261043000000_website_launch_signups.sql`). Website needs `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in `website/.env`. |
| Oct 17, 2026 | **Launch signup owner email:** Each new signup (not duplicates) queues one `website_launch_signup` mail to **mikesommers@gmail.com** (migration `20261043300000_website_launch_signup_owner_email.sql`). Same Resend worker; subject **New website launch signup**, body includes the submitted address. Revisit when production admins are live. |
| Oct 17, 2026 | **Admin email list:** `/admin/email-list` lists signups via RPC `admin_list_website_launch_signups` (migration `20261043100000_admin_list_website_launch_signups.sql`). Nav link **Email list** in the admin shell. |
| Oct 17, 2026 | **Legal pages:** `/privacy-policy`, `/terms-of-service`, `/community-guidelines` with shared header/footer; footer links wired. Copy in `website/src/data/legal/`. |
| Oct 17, 2026 | Homepage: **Support** section and nav label renamed to **FAQs** (`#faqs` anchor). |
| Oct 17, 2026 | FAQs: added **Why do I have to record videos of myself?** as first item (desktop + mobile + site). |

### Open design follow-ups

- [x] Link Privacy, Terms, and Community guidelines to `/privacy-policy`, `/terms-of-service`, and `/community-guidelines` (Oct 17, 2026).
- [ ] Refine subscription tier bullets when the Free / Gold / Platinum model is defined.
- [ ] Optional: add anchor IDs / section labels in Pencil for handoff to code (not required for static design).
