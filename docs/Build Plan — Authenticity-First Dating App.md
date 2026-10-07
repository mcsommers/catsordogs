# Build Plan — Authenticity-First Dating App

Sep 28, 2026 · @Mike

## How to Use This Plan

This plan turns the MVP Scope & Requirements doc into an order of work for Cursor's AI agent. The backend, the server rules, and the admin panel come first because they don't depend on how anything looks. The screens users see wait on the designs.

A few working habits will save you a lot of pain:

- **One phase at a time.** Give the Cursor agent a single phase, let it build and test, review the result, commit, then move on. Handing it the whole app at once produces code nobody can check.
- **The requirements doc stays the source of truth.** Every prompt below points at it. When a decision changes, change the doc first, then tell the agent.
- **Put the never-break rules in a project instructions file** (an `AGENTS.md` in the project root, or a rule in `.cursor/rules`; a starter is in the prompts section) so every session starts with them.
- **Ask for tests with each phase**, especially for the server rules: the daily gate, follower anonymity, and the nudge caps.
- **After each phase, ask the agent to explain in plain language what it built and what assumptions it made.** That's your review method if you don't read code.
- **Keep the project in version control** and make one commit per phase, so you can always go back to a working state.

## Stack

&#91;embedded content: architecture · app, backend, four outside services, admin panel\]

Everything the app shows comes from the backend. The rules in the next sections live in the database and server functions, never in the app itself.

| Layer | Recommended | Why |
| --- | --- | --- |
| Mobile app | Expo (React Native) | One codebase for iOS and Android, with built-in camera, push notifications, and store build tooling. It is well supported by the Cursor agent. |
| Backend | Supabase (Postgres, auth, storage, server functions) | Your data is relational (users, follows, matches, flags), and row-level access rules help enforce follower anonymity. |
| Video | A hosted video service (Mux) | Handles upload, conversion, streaming, and thumbnails. Don't build this yourself. Confirm current pricing, since video is likely your biggest recurring cost. |
| Captions | A speech-to-text API (Mux should handle this) | Needed for the caption review step and for text-based match ranking. |
| Moderation | A content moderation API plus your own flag-and-review flow | Proactive screening for the worst content categories, not flags alone. |
| Push notifications | Expo's push service, which routes through Apple and Google | Daily question, matches, and nudges. |
| Admin panel | A small web app, or a low-code tool such as Retool over the same database | Question calendar, settings, and moderation queue. Plain and functional is fine. |
| Environments | Separate development, staging, and production projects | Lets you test without touching real users' videos. |
| Email | A transactional email service (Resend) | Match, nudge, and daily-question emails, alongside push. Needs an unsubscribe/preference mechanism. |

## Accounts to Create, In Order

The Cursor agent can write the integration code, but each of these is your own account, created outside this conversation. Never paste the API keys they generate into chat — the agent reads them from environment variables in your own project.

1. **Supabase** — free tier is enough for development. Gives you the project URL and keys needed from Phase 0.
2. **Expo** — free. Used for development builds now, and for store submission through EAS later.
3. **A video service** (Mux) — needed before Phase 3. Usually asks for a card on file even on a trial tier.
4. **A transcription service** — only if your video service doesn't already include auto-captions. Mux handles this.
5. **An email service** (Resend) — needed before Phase 5, for match, nudge, and daily-question emails.
6. **A moderation API** — needed before Phase 7.
7. **Apple Developer Program** ($99/year) and **Google Play developer registration** ($25 one-time) — needed before Phase 10. Start Apple's identity verification a couple of weeks ahead of when you'll actually submit, since it can take a few days and involves a phone call.

Check current pricing on each before committing — most of these bill by usage past a free tier, and fees can change.

## Data Model

These are the main tables the agent should create in Phase 1 through Phase 7. The column that matters most is Access: it says who can read each table, and it is where follower anonymity is either protected or lost.

| Table | What it holds | Access |
| --- | --- | --- |
| profiles | First name, birthday (age is calculated), photos, gender, pronouns, sexual orientation, height, city, job title, company, school, bio (500 characters), lifestyle tags, languages, interests (up to 5), and relationship goals. Also the "allow followers" setting and the join date. The profile questions will change as user feedback arrives, so keep profile fields and the Feed Settings filters tied together in configuration (see requirements doc). | A user edits their own row. Others see it only through the feed function. |
| profile\_photos | Up to 6 photos per profile (position 1 to 6), pointing to files in a private storage bucket. At least 1 is required to finish a profile. Files live in a folder named after the user. When an account is deleted (Phase 7), the files must be deleted from storage too; they do not go away automatically with the database rows. | Own rows only. Other people's photos are served later by server functions as short-lived links. |
| profile\_options, profile\_field\_defs, filter\_definitions | Configuration: the allowed answers for each profile question (gender, lifestyle tags, interests, relationship goals, and so on), the rules for each question (single or multiple choice, whether custom entries are allowed, maximum number), and the list of filters with their type and limits. Screens and server checks both read these, so adding or removing a profile question (and its filter) is a data change plus one column. | Signed-in users can read. Only admins write (admin panel, Phase 8). |
| filter\_preferences | Each user's own filter choices (age range, distance, and so on), stored as one row per user and checked against the filter definitions below. "Any" means the filter is not set. Ranking weights are not here; they live in feed\_settings. | Own row only. |
| questions | One row per day: the date, the question text, and whether an admin overrode it. | Everyone can read today's question. Only admins write. |
| app\_settings | Recording length (default 14 seconds), minimum watch time, onboarding mode (today's question or a fixed question) and the fixed question, followed-content cap in the feed, flag threshold, and feed look-back days (how many earlier days the feed rolls back through; default 7). | Admins write. The app reads the few values it needs. |
| answers | One row per user per question: video reference, duration, caption text, and a status (live, disabled by flags, removed). Unique on user and question. | A user reads their own. Others only through the feed function, and only after passing the gate. |
| answer\_views | Who viewed an answer. | Only the counts are returned to the poster, never the rows. (There is no separate reactions table in v1; a "like" is a match request.) |
| profile\_views | Who viewed a profile. | Only the count is returned to the profile's owner, never the rows. |
| feed\_settings | Each user's ranking weights (Low / Medium / High for six signals). Built in Phase 4. (Filter choices are in filter\_preferences.) | Own row only. |
| streaks | Consecutive-day answer count per user, derived from answers. | Public count, computed on the server. |
| follows | Who follows whom. | **No app access at all.** Only server functions read or write it. |
| nudges | Who nudged whom, on which question. Unique on sender, target, and question. Plus a record of the one notification sent to each target per day. | **No app access at all.** Server functions only. |
| match\_interests | A user's choice to be matched with a specific profile. | Server functions only. |
| matches | Pairs of users with mutual interest. | Each user sees only their own matches. |
| messages | Text messages (with emoji) inside a match, plus a per-conversation mute setting. Video and photo messages are later, so don't assume text-only content in the table design. | Members of the match only. |
| blocks | Who has blocked whom, and when. Built in Phase 4 so the feed can use it from the start. A block hides the two people from each other in both directions and is never announced to the blocked person. In Phase 6 a block also removes any match and ends the chat. Written only by server functions (block and unblock). One more server function returns the user's own blocked and Not Interested people (name, age, photo, date) for the Blocked and Not Interested screen. | The blocker can read their own rows (for the Blocked users list, 08b). The blocked person can never read anything about it. |
| not\_interested | Who a user has hidden from their own feed with "Not Interested": the user, the person, and when. One direction only: it changes nothing for the other person, who is never told. Built in Phase 4 with the feed. Written only by server functions (mark and undo). | Own rows only. |
| reports | Reports on profiles and chat messages: who reported, target, why, when. Unique per reporter and target. Queue priority is raised when distinct reporters on a profile reach the admin-set count (added to app\_settings). | Reporters write. Only moderators read. |
| flags | Reports on a single answer: who reported, why, when. Unique on answer and reporter. | Reporters write. Only moderators read. |
| moderation\_actions | Review decisions, disabled videos, and appeals. | Moderators only. |
| device\_tokens | Phone push tokens. | Own rows only. |
| notification\_preferences | Per-user opt-in/opt-out for each notification type, separately for push and email | Own row only |

The two rows in bold are the whole anonymity guarantee: if the app can never read `follows` or `nudges`, it can never leak who is following whom, however the screens are built.

## Rules the Server Must Enforce

Anything the app enforces alone can be bypassed by someone editing the app or calling the backend directly. Each rule below lives in the database or a server function, and each one needs an automated test before you move on.

- **The daily gate.** A user gets nothing from the feed until they have a live answer for today's question. The check runs in the feed function, not in the screen.
- **Recording length and immutability.** Reject uploads longer than the admin-set recording length. Once an answer is submitted it can't be replaced; re-recording happens only before submit, and captions are editable only before the video goes live.
- **Follower anonymity.** Follower identities never leave the server. The app receives a follower count and nothing else. If a user has turned off followers, new follow attempts are rejected.
- **Nudge limits.** One nudge per follower, per followed profile, per day. One nudge notification per recipient per day, however many followers nudge. A nudge is rejected if the target has already posted today. The notification says that followers want to hear the answer, with a count when there is more than one, and never who.
- **Feed ordering.** Followed profiles' current-day videos come first, capped at the admin-set share of the visible feed. Followed profiles appear even if they fall outside the viewer's filters. After that comes the filtered, ranked feed. Blocked users (in either direction), people the viewer marked Not Interested, and disabled videos are excluded, even if the viewer follows them.
- **Per-video moderation.** When a single video reaches the flag threshold, only that video is disabled, never the account. Disabled videos go to the moderator queue and can be appealed.
- **Blocking.** A block hides the two people from each other everywhere (feed, profiles, match requests, matches and chat), whichever of them blocked. The blocked person is never told and cannot find out from any response. Blocking removes any match and ends the conversation, and neither person can send the other a match request or a message. A user can unblock at any time, silently. Unblocking does not restore a match, chat or follow. If both people blocked each other, they stay hidden from each other until both blocks are lifted.
- **Not Interested.** Hides that person from the user's own feed only. It is silent and one-directional. If the user follows that person, it also removes the follow (silently); the unfollow part is wired in during Phase 5, when follows exist. It changes nothing else (no match is removed and the other person's view is unaffected). It can be undone by the user at any time, which does not restore a follow.
- **Minimum age.** Signup is blocked below the minimum age. Self-attestation is enough for the MVP, but the check happens on the server.
- **Admin settings take effect everywhere.** Recording length, minimum watch time, onboarding mode, the followed-content cap, the feed look-back days, and the flag threshold are read from settings, never hard-coded in the app.
- **Notification opt-outs are honored everywhere.** Each notification type (daily question, matches, messages, nudges) can be turned off separately for push and for email. Email in particular needs a working unsubscribe link, since that's a legal requirement, not just good practice.

## Build Phases

The backend phases (0 through 8) don't need designs, so they can start now. The UI phases (A through E) each wait on the designs for those screens. Phase A is the core loop and the one to design first.

| Phase | Goal | What you have at the end | Waits on designs? |
| --- | --- | --- | --- |
| 0. Foundations | Project setup, environments, project instructions file, test tooling | An empty app and backend that build and deploy | No |
| 1. Accounts and profiles | Signup, login, age attestation, profile fields, filter preferences, access rules | Secure profile data, checked through plain temporary test screens | No |
| 2. Question engine and settings | Question calendar, admin-editable settings, today's-question endpoint, onboarding mode | Today's question served from data an admin can change | No |
| 3. Video pipeline | Upload, length enforcement, transcription, caption data, playback | A video can be uploaded, captioned, and played back | No |
| 4. Gate and feed | Answer submission, the daily gate, the feed function with filters, followed-first ordering and its cap, basic text ranking, blocks and Not Interested applied to the feed | A feed that responds correctly in every gate state and never shows blocked or hidden people | No |
| 5. Follow, nudge, notifications | Server-only follows and nudges, counts, caps, push and email notifications, notification preferences | Anonymity and cap tests all passing | No |
| 6. Matching and messaging | Match interest, mutual match, match notification, messages, block handling (removes matches, ends chats, stops requests and messages) | Two users can match and talk (scope depends on the gaps section) | No |
| 7. Moderation and safety | Video flags, profile and message reports, per-video disabling, moderator queue, appeals, automatic screening, account deletion | A moderator can review and act on flagged videos | No |
| 8. Admin panel | Question calendar editor, settings screen, moderation queue | An internal tool that runs the app without touching the database | No |
| A. Onboarding and core loop | Signup, first recording, daily gate, recording screen, caption review | The full first-session experience on a real phone | **Yes** |
| B. Feed and browse | Scrollable video feed, minimum watch time, captions, followed-first display | Browsing that feels right on a phone | **Yes** |
| C. Profile and archive | Profile view, archive timeline, view counts and reactions | Profiles that show the answer history, including scrolling between a person's answers from the full-screen answer view (06k) | **Yes** |
| D. Social screens | Follow, nudge, match, messages, filters, settings, the more-options menu (Not Interested, Report, Block), the Blocked and Not Interested list with Unblock and Undo, flagging | Every remaining user-facing screen | **Yes** |
| E. Polish | Empty, loading, and error states, notification wording, accessibility | An app ready for testers | **Yes** |
| 9. Hardening | End-to-end testing, security review, cost check, privacy and legal review | A list of fixed issues and sign-offs | No |
| 10. Beta and store submission | TestFlight and Google Play internal testing, fixes, store review | Live in both stores | No |

The order that works best: run phases 0 through 5 while you design the core-loop screens, then start Phase A as soon as its designs exist. Phases 6 through 8 can run alongside the UI phases.

## Prompts for the Cursor agent

Before you start, make sure the MVP Scope & Requirements doc, the Concept Doc, and this build plan are saved as Markdown in the `docs` folder inside the project (they are), so the agent can read them. Then put the starter below in a file named `AGENTS.md` at the project root (or in a `.cursor/rules` rule set to always apply).

```
# Project: Authenticity-first dating app

Source of truth: "docs/MVP Scope & Requirements — Authenticity-First Dating App.md"
and "docs/Build Plan — Authenticity-First Dating App.md". Background and
product intent: "docs/Concept Doc — Authenticity-First Dating App.md".
The screen designs are in the Pencil file (pencil-new.pen); the requirements
doc names each screen.
If the code and the docs disagree, ask before deciding.

Stack: Expo (React Native) for iOS and Android, Supabase (Postgres,
auth, server functions), a hosted video service, Expo push, an email service.

Rules that must never break:
1. The app never reads follower identities. The follows and nudges
   tables have no client access; only server functions touch them.
2. The daily gate, nudge limits, recording length, and moderation
   thresholds are enforced on the server, never only in the app.
3. Admin-editable settings (recording length, minimum watch time,
   onboarding mode, followed-content cap, feed look-back days, flag threshold) come from
   the app_settings table. Never hard-code them.
4. A flag disables one video, never an account.
5. Every server rule gets an automated test.

Working style: build one phase at a time. When finished, summarize
in plain language what you built, what you assumed, and what I
should check. List anything in the docs that was unclear. Do not
add features outside the current phase.
```

Then use one prompt per phase, in order. Bracketed items are decisions you still need to make.

- **Phase 0.** "Set up a new Expo (React Native, TypeScript) project and a Supabase project with development and staging environments. Add automated testing for the database and server functions, and a README explaining how to run everything. Don't build any features yet."
- **Phase 1.** "Read 'docs/MVP Scope & Requirements — Authenticity-First Dating App.md'. Build accounts and profiles: signup and login, age attestation with a minimum age enforced on the server, the profile fields from the requirements, and filter preferences. Add row-level access rules so users can only edit their own rows. Build plain temporary test screens only so we can check it works. Include tests."
- **Phase 2.** "Build the question engine: a questions table with one question per date, an app\_settings table with the settings listed in the Data Model section of 'docs/Build Plan — Authenticity-First Dating App.md', and an endpoint that returns today's question. Support the onboarding mode setting (today's question or a fixed question). Include tests."
- **Phase 3.** "Build the video pipeline using \[video service\]: issue an upload link, accept a recording, reject anything longer than the recording-length setting, generate captions with \[transcription service\], store the caption text for review, and return a playback URL. Add a simple test screen for recording. Include a test for the length limit."
- **Phase 4.** "Build answer submission and the feed. An answer is one per user per question and can't be changed after submit. The feed function returns nothing until the user has a live answer for today. After that it returns today's answers filtered by the user's filter preferences, with followed profiles first up to the cap in app\_settings, then basic text-based ranking using captions. Also build blocks and not\_interested: server functions to block and unblock someone (silent, hides both people from each other in both directions) and to mark someone Not Interested and undo it (silent, hides them from my feed only), plus one function that lists the people I have blocked or marked Not Interested, with no way for the other person to see any of it. The feed must exclude both, even for followed profiles. Include a test for each gate state and for the cap, and tests that blocked people (in either direction) and Not Interested people never appear."
- **Phase 5.** "Build follow and nudge entirely on the server. The follows and nudges tables must have no client access. Provide functions to follow, unfollow, and nudge, plus one that returns a follower count. Enforce every limit in the Rules the Server Must Enforce section, including one nudge notification per recipient per day. Add push tokens, \[email service\] integration, and per-type notification preferences. Send the daily question and match/nudge notifications through both push and email, honoring each user's preferences and including a working unsubscribe link on email. Write tests that prove an app user can never read who follows them."
- **Phase 6.** "Once I've added the match and messaging requirements to the requirements doc, build match interest, mutual matching, the match notification, and messaging as specified. A block must remove any existing match, end the chat, and stop match requests and messages in both directions, with tests." (Wait for the gaps section to be resolved.)
- **Phase 7.** "Build moderation: flagging an answer, disabling that single video when flags reach the threshold, a moderator review queue, appeals, profile and message reports (moderator review only, high priority when many different people report the same profile), and account deletion. Blocking is already built in Phases 4 and 6. Add automatic screening using \[moderation service\]. Include tests showing that a flagged video is disabled and the account is not."
- **Phase 8.** "Build a small web admin panel (or configure \[low-code tool\]) for the question calendar with overrides, the app settings, and the moderation queue. Only admins can sign in."

For the UI phases, give the agent the design export or screenshots for just those screens, along with the matching rows from the requirements doc, and tell it to use the existing backend functions without changing the rules.

## Review Checkpoints

The agent can build most of this, but you shouldn't be the only reviewer. These are the moments where an outside pair of eyes is cheap compared to fixing the problem later.

| When | What to check | Who |
| --- | --- | --- |
| Before Phase 3 stores any real person's video (your own test videos are fine) | How video is stored, how long it is kept, consent wording, and biometric privacy exposure from keeping facial video. Also the account deletion path, since deletion and "stored forever" pull in opposite directions. | A lawyer familiar with privacy law |
| After Phase 1 | The database access rules. A mistake here can expose private data, and it's easy to miss if you can't read the rules. | A developer experienced with Supabase or Postgres |
| After Phase 4 | That blocked people (either direction) and people marked Not Interested can never appear in the feed, and that nothing in any response tells a user they were blocked. | A developer or security reviewer |
| After Phase 5 | That follower anonymity holds: try to read the follows and nudges tables using an ordinary user's credentials, and confirm it fails. Review the tests too. | A developer or security reviewer |
| After Phase 7 | Flagging, reports, appeals, and automatic screening work as intended, and that the app meets the stores' rules for user-generated content. | A developer, plus you reading the current store guidelines |
| Phase 9 | Security review of the whole backend. A cost estimate for video storage and streaming at a few user counts, using the video service's current pricing. | A developer, plus you on the cost math |
| Before store submission | Current Apple and Google requirements for dating and user-generated-content apps, the age rating, and the privacy disclosures. These change, so read them fresh. | You, with a developer |

A few days of a developer's time at the first two checkpoints is much cheaper than discovering an access-rule mistake after real users have signed up.

## Gaps to Close Before Building

While turning the requirements into a plan, I found things they don't yet say. Some block a phase; others just need a decision. Each is easier to settle now than to have the agent guess.

**Settled by the design (now in the requirements doc):**

- **Match interest and mutual match.** A match request notifies the recipient, who sees it under Incoming with the answer that was liked. They can accept or decline, and the sender sees it under Outgoing as waiting for a response, with Cancel Request and View Profile buttons. A mutual match opens a chat. Phase 6 is unblocked.
- **Messaging.** Text with emoji only for now, with per-conversation mute. Video and photo messages are possible later.
- **Blocking users and reporting.** Block (removes any match, ends the chat) is designed; it is built in Phases 4 and 6, with reports and flags in Phase 7. Reports cover videos, profiles, and chat messages. Profile and message reports go to the moderator queue for human review only; a profile reported by many different people (admin-set count) is marked high priority. Nothing is hidden automatically.
- **Existing followers when someone turns followers off.** They can no longer nudge, and no one can follow. (Whether they're removed from the follower list entirely wasn't specified; the count presumably drops.)
- **A thin feed.** The feed rolls over automatically to the previous day (and earlier days) when today's supply is empty or runs out, with a banner marking the change. The banner is dismissed automatically once the user scrolls past the first video of the earlier day. The Question Pill shows the date of the question for each day. The feed function needs to return answers across days in order. The rollover goes back as many days as the admin-set "feed look-back days" setting (default 7), then shows a "You're all caught up" end screen (06v). The setting must be editable in the admin panel (Phase 8).
- **Followed profiles and filters.** Following overrides filters, so followed profiles appear first even outside the viewer's filters (up to the cap). Users can unfollow from the feed menu or a profile menu, with a confirmation; the other person is never notified.
- **Account deletion.** Permanent and immediate after one confirmation, removing the profile, photos, videos, chats, and matches. Still take the wording and any retention exceptions (such as moderation records) to the lawyer at the first checkpoint. The confirmation screen is not yet designed.
- **Photos.** Profiles do show photos (Build Profile asks for a few, and profile pages have a Photos section). At least 1 photo is required to finish Build Profile (up to 6); enforce on the server too.

**Still open:**

- **Location and distance.** The profile stores only a typed city, which cannot measure distance. Decide how location is captured (device permission or looking up the city) before Phase 4. See the requirements doc.
- **Apple and Google sign-in.** Email and password work now. "Continue with Apple" and "Continue with Google" need the Apple Developer account and a Google sign-in setup, and are switched on in Phase A.
- **Email confirmation.** Locally, sign-up signs people in immediately. Decide whether staging and production should require confirming the email address first.

- **Help & Support.** Settled: the Account menu row opens an external help website. The URL is a config value, still to be supplied; no in-app screens or backend.

- **Background blur and photo background (deferred).** Not in v1 and removed from the recording screens and designs. If added later, it most likely has to run on the phone during recording (a video host like Mux is not expected to replace backgrounds), so check Expo support and device performance first, and build it as a removable module.

Once you've decided these, I can add the matching rows to the MVP Scope & Requirements doc so the plan and the requirements stay in step.
