# Project: Cats or Dogs? (authenticity-first dating app)

Source of truth: "docs/MVP Scope & Requirements — Authenticity-First Dating App.md"
and "docs/Build Plan — Authenticity-First Dating App.md". Background and
product intent: "docs/Concept Doc — Authenticity-First Dating App.md".
The screen designs are in the Pencil file (docs/pencil-new.pen); the requirements
doc names each screen.
If the code and the docs disagree, ask before deciding.

**IMPORTANT — Read specs and design before you implement (standing instruction from Mike):**
Before writing or changing product-facing code (mobile UI, copy, flows, admin
screens), you **must** consult the written documents **and** the design file.
Do not implement from memory, from similar apps, or from partial context in the
chat. This is as important as the “rules that must never break” below.

1. **Written docs:** Read the sections that apply — at minimum the MVP
   requirements and Build Plan for the current phase; also UAT-flows,
   mobile-questions, and Concept Doc when they bear on the work.
2. **Design file:** Open the matching frame(s) in docs/pencil-new.pen via the
   Pencil MCP tools (screen numbers such as 06, 06c match the requirements).
   Note every control, label, layout, and state you are about to build.
3. **Then implement** so code matches docs and design. If something is missing
   or unclear in docs or Pencil, ask Mike before inventing UI or behavior.

Skipping this step is how extra buttons, wrong copy, and layout drift get into
the app. After implementation, keep docs and Pencil in sync (see below).

**Design file changes ship end-to-end (standing instruction from Mike):**
Whenever Mike asks you to change **docs/pencil-new.pen** (or to implement
something because the design file was updated), treat that as a full product
change unless his **same prompt** explicitly narrows scope (for example “Pencil
only” or “docs only”). In the default case, in **one piece of work**:

1. **Design file** — make the Pencil edits (via Pencil MCP tools only).
2. **docs/** — update every relevant doc (at minimum MVP, Build Plan, UAT-flows,
   mobile-questions, README, feed-rules, master-test when applicable; see list
   below).
3. **Database** — update schema, grants, RPCs, seeds, and **migrations** under
   `supabase/migrations/`; add or adjust automated tests under `supabase/tests/`
   when server rules change.
4. **Code** — update **mobile** and the **admin panel** so behavior, copy, and
   layout match the design and docs.

Do not stop at Pencil or docs alone and leave migrations or app code for a
follow-up unless Mike’s prompt clearly limits the work. Say in the summary what
Mike must run on Supabase (for example `db push` on staging) when migrations
land.

Stack: Expo (React Native) for iOS and Android, Supabase (Postgres,
auth, server functions), a hosted video service, Expo push, an email service.

Mobile platforms (standing instruction from Mike):
Unless Mike specifies otherwise, every change to the mobile app applies
to both Android and iOS — same screens, copy, and behavior. If one
platform truly needs a different implementation (for example an OS bug
workaround), say why in the summary and note it in docs/UAT-flows.md when
it affects what Mike should test on each phone.

Mobile testing environment (standing instruction from Mike):
Mike runs the app on a **real phone in Expo Go**, not a custom development
build or store build, unless he says otherwise. Assume **staging** (`mobile/.env`
points at Cats or Dogs - Staging). He starts the app with `cd mobile && npm run phone`
(not `npm start`). When giving test steps or troubleshooting:

- Do **not** tell him to rebuild the native app or run `expo prebuild` unless he
  explicitly wants to leave Expo Go or you have confirmed a feature cannot work
  in Expo Go at all.
- **Expo Go limits that are normal for this project:** remote push on Android
  (SDK 53+) does not work in Expo Go — use email for notification UAT; a yellow
  **"WebCrypto API is not supported"** warning after sign-up is expected in Expo Go
  (Supabase still completes email sign-up); native modules not in the Expo SDK
  (for example `react-native-quick-crypto`) are unavailable until a dev build exists.
- Email confirmation and password-reset links must be opened on the **same phone**
  running Expo Go, after a fresh `npm run phone` if the dev server restarted.
- Admin UAT uses `npm run admin` on the Mac; it is separate from Expo Go.

If a change requires a development build, say so plainly, explain what breaks
in Expo Go today, and offer an Expo Go–compatible path when one exists.

Mobile forms (standing instruction from Mike):
Show field-level errors as soon as the rule is knowable (for example an
under-18 birthday right after the user picks a date). When the user
submits a form that still has errors, scroll the screen to the first
field with an error so they can fix it without hunting.

Product copy punctuation (standing instruction from Mike):
Never use em dashes (the `—` character) in user-facing copy. That includes
mobile and admin UI strings, marketing site text in `docs/website.pen`,
labels and designed strings in Pencil, notification and email wording, and
any doc that records exact in-app text users see (for example
`docs/UAT-flows.md` and `docs/master-test.md` expected results). When you
would use an em dash, pick clearer punctuation instead (comma, period,
semicolon, colon) or rewrite into two sentences. Hyphens in compound words
are fine. En dashes in numeric ranges (for example `3–5`) are fine. Do not
use an em dash as an empty table cell; use `-` or `n/a`. If you touch
existing copy that still has em dashes, rewrite it in the same pass. This
rule does not apply to existing document filenames or to internal code
comments.

Rules that must never break:
1. The app never reads who follows a user (follower identities). The
   follows and nudges tables have no client access; only server
   functions touch them. `get_people_i_follow` may list the people the
   signed-in user follows (08i), never the people who follow them.
2. The daily gate, nudge limits, recording length, and moderation
   thresholds are enforced on the server, never only in the app.
3. Admin-editable settings (recording length, minimum watch time,
   onboarding mode, followed-content cap, feed look-back days, flag threshold,
   nudge notification delay, location provider) come from
   the app_settings table. Never hard-code them.
4. A flag disables one video, never an account.
5. Every server rule gets an automated test.
6. **Feed scroll is a unified vertical page.** On screen **06**, swiping moves the
   video and all chrome (pill, controls, captions, metadata) together as one
   page. Do not replace this with a fixed overlay above the scroll list. See
   `docs/mobile-feed-scroll.md` before any feed touch or layout change.

Docs and designs stay in sync with the code — after you implement (standing instruction from Mike):
Any time you change app code (mobile, admin, database behavior, or anything
that changes what users see or do), update the relevant files under docs/ and
update docs/pencil-new.pen in the same piece of work. The design-file rule
above is the mirror image: design-led changes must also reach docs, database,
and code. Do not wait to be asked and do not treat any of these as optional
follow-ups.

Under docs/, keep in sync at minimum:
- `docs/mobile-feed-scroll.md` when feed paging, touch handling, or chrome layout changes
- MVP Scope & Requirements when behavior, copy, or rules change
- Build Plan when scope, data model, or phase deliverables change
- docs/UAT-flows.md when mobile screens, states, or wording change
- docs/mobile-questions.md when product decisions are recorded
- README when setup, env, or commands change

The design file must reflect the same screens and UI the code ships: layout,
labels, controls, and designed states. Edit docs/pencil-new.pen only through
the Pencil MCP tools, never as plain text. New top-level screens must not
overlap existing frames. Before placing one, use Pencil's FindEmptySpace
(padding 80) so it lands in a clear gap; chain to a related screen with
nodeId and direction "right" (or "bottom" if that row is full). Never pick
x/y by hand.

In the end-of-phase summary, list exactly what you changed in docs/ and in
the design file.

Secrets: never commit API keys, tokens, or .env files. Read them from
environment variables. Commit only .env.example files with placeholder values.

Working style: build one phase at a time. When finished, summarize
in plain language what you built, what you assumed, and what I
should check. List anything in the docs that was unclear. Do not
add features outside the current phase.

Mike is a product manager, not a professional developer. Write for
that reader. If a step is Mike's to take, explain it in everyday
terms: what it is, why it matters, and what to do. Define jargon
the first time it appears. Whenever you can do the work yourself
(commands, git, GitHub, Supabase, tests, file edits), do it or
offer to do it — do not leave a homework list of things you could
have run.

Check, don't guess (standing instruction from Mike):
When an answer depends on whether something is already set up — a
worker, a secret, a scheduled job, a remote setting, a row in the
database, an environment — look it up before you answer. Check the
place that actually matters (local, staging, production, or all of
them). Say what you found. Do not say it might or might not be done.

User acceptance tests (standing instruction from Mike):
docs/UAT-flows.md holds the hands-on tests Mike runs on a real phone to
confirm the mobile app works as designed and specified. In every mobile
phase (A through E, and any later phase that changes what the app shows or
does), add or update that phase's section in the same piece of work: one
checkbox per test, with a test ID (e.g. B-04), plain-language steps, the
screen number from docs/pencil-new.pen, and the exact expected result
(wording as it appears in the app). Cover the main path, every designed
state (empty, error, limit, locked), and every rule the requirements set
for those screens. Check expected wording against the code, not memory.
If a later change alters an earlier phase's behavior, update those tests
too. When a test needs something Mike can't do from the phone (an admin
setting, a missing question, a staging-only condition), say so in the step
and offer to do it for him. In the end-of-phase summary, point Mike to the
new tests.

Git workflow: one branch per phase (e.g. phase-0-foundations), one pull
request per phase into main. Never commit directly to main after the
initial commit.
