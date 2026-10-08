# Project: Cats or Dogs? (authenticity-first dating app)

Source of truth: "docs/MVP Scope & Requirements — Authenticity-First Dating App.md"
and "docs/Build Plan — Authenticity-First Dating App.md". Background and
product intent: "docs/Concept Doc — Authenticity-First Dating App.md".
The screen designs are in the Pencil file (docs/pencil-new.pen); the requirements
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

Docs and designs stay in sync with the code (standing instruction from Mike):
Whenever a decision or change alters anything the docs in docs/ describe
(requirements, data model, rules, build plan, scope) or what a screen in
docs/pencil-new.pen shows, update the affected doc(s) and the design file in
the same piece of work, so docs, designs and code never disagree. Do not
wait to be asked. In the end-of-phase summary, list exactly what you changed
in docs/ and in the design file. Edit the .pen file only through the Pencil
tools, never as plain text. New top-level screens must not overlap existing
frames. Before placing one, use Pencil's FindEmptySpace (padding 80) so it
lands in a clear gap; chain to a related screen with nodeId and direction
"right" (or "bottom" if that row is full). Never pick x/y by hand.

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

Git workflow: one branch per phase (e.g. phase-0-foundations), one pull
request per phase into main. Never commit directly to main after the
initial commit.
