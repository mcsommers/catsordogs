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

Secrets: never commit API keys, tokens, or .env files. Read them from
environment variables. Commit only .env.example files with placeholder values.

Working style: build one phase at a time. When finished, summarize
in plain language what you built, what you assumed, and what I
should check. List anything in the docs that was unclear. Do not
add features outside the current phase.

Git workflow: one branch per phase (e.g. phase-0-foundations), one pull
request per phase into main. Never commit directly to main after the
initial commit.
