# Cats or Dogs?

An authenticity-first dating app. Every day, everyone answers the same question on camera
(14 seconds by default) to unlock the feed of everyone else's answers.

Product docs and screen designs live in [`docs/`](docs/). Start with the
MVP Scope & Requirements doc. Rules for the AI coding agent are in [`AGENTS.md`](AGENTS.md).

## Project layout

| Folder | What it is |
| --- | --- |
| `mobile/` | The Expo (React Native, TypeScript) app for iOS and Android |
| `supabase/` | The backend: database migrations, server functions, and database tests |
| `docs/` | Requirements, build plan, concept doc, and the Pencil design file |

## One-time setup

You need: Node 24 (already installed), Git, and [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(the local database runs in Docker). If `db:start` reports an unhealthy container, check that Docker Desktop is running.

```sh
npm install              # in the project root: installs the Supabase command line tool
cd mobile && npm install # installs the app's dependencies
cp mobile/.env.example mobile/.env   # then fill in the values (see below)
```

## Everyday commands

Run from the project root unless noted.

| Command | What it does |
| --- | --- |
| `npm run db:start` | Starts a local copy of the backend (needs Docker). Prints the local URL and keys to put in `mobile/.env`. |
| `npm run db:stop` | Stops it |
| `npm run db:reset` | Rebuilds the local database from the migration files |
| `npm run db:test` | Runs the database tests (rules like the daily gate live here) |
| `npm run api:test` | Runs end-to-end tests through the real API and Edge Functions as signed-in users (needs `db:start` running). Uses a stand-in for Mux, so it needs no Mux account or secrets. |
| `npm run unit:test` | Runs small tests of plain helper code (such as the caption file reader) |
| `cd mobile && npm start` | Starts the app (press `i` for the iOS simulator). A real phone can't reach `127.0.0.1`; use your computer's network address in `mobile/.env` instead. |
| `cd mobile && npm test` | Runs the app's tests |
| `cd mobile && npm run typecheck` | Checks the app's TypeScript for errors |

## Making yourself an admin

Admins can edit the question calendar and app settings (through the admin panel, built in Phase 8).
Nobody can make themselves an admin from the app. To add one, sign up in the app first, then run this
in the SQL editor of the right Supabase project (the local one is at http://127.0.0.1:54323), replacing the email:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'you@example.com';
```

## Local sample data

`npm run db:reset` rebuilds the local database and loads `supabase/seed.sql` (a week of past questions) and
`supabase/sample_questions.sql` (20 placeholder questions: today and the next 19 days), so there is always a "today"
question locally. Neither file is applied automatically to staging or production. To put the 20 sample questions
there, run `sample_questions.sql` in that project's SQL editor (it skips days that already have a question, and an admin
can swap any of them later from the admin panel, Phase 8).

## Environments

There are three separate Supabase projects so testing never touches real users' data:

| Environment | Supabase project | Mux environment | Video keys file | Used for |
| --- | --- | --- | --- | --- |
| Local | Docker, on your computer | A stand-in (automated tests only) | none | Day-to-day development. The app's keys go in `mobile/.env`. |
| Staging | "Cats or Dogs - Staging" (`pgwnqasselhstrechmsa`) | Staging, with `MUX_TEST_MODE=true` | `supabase/functions/.env.staging` | Testing with real services before release |
| Production | "Cats or Dogs - Production" (`fvnbcofflierdlnnglko`) | Production, test mode off | `supabase/functions/.env.production` | Real users. No real users' video until the legal review in the Build Plan is done. |

Project IDs are not secret (they appear in the project's web address). Keys and secrets are.

Never commit keys or `.env` files. Only `.env.example` (with blank values) is committed.

## Video (Mux)

Videos are stored, converted, captioned and streamed by Mux; our database only stores Mux's ids, the length and the captions.
Mux has its own Staging and Production environments. Use them like the Supabase ones:
**Mux Staging with Supabase Staging** (and local testing), **Mux Production only with Supabase Production**.
Do not record real users' video in Mux Production until the legal review in the Build Plan is done.

Six Edge Functions (in `supabase/functions/`) do the work: `create-video-upload` (the app asks for an upload link),
`mux-webhook` (Mux reports progress, checked against Mux's signature), `get-playback-url` (short-lived signed links to watch your own recording, or another person's answer once the daily gate is open),
`update-location` (looks up coordinates for the city on a profile, so distance works),
`process-notifications` (sends queued push and email), and `unsubscribe` (the link in every email).

### City lookup (distance)

`update-location` uses a free geocoding service by default (Open-Meteo), whose free tier is for non-commercial use. Before launch,
choose a service you can use commercially and set `GEOCODING_URL` in the functions' settings file (see `supabase/functions/.env.example`).
The service must accept `?name=<city>&count=1` and answer `{ "results": [{ "latitude": ..., "longitude": ... }] }`.

### Connecting a Mux environment

In the Mux dashboard, with the right environment (Staging or Production) selected:

1. **Settings > Access Tokens**: create a token with permission for **Mux Video** (read and write). You get a Token ID and Token Secret.
2. **Settings > Signing Keys**: create a signing key for Video. You get a Key ID and a private key (shown once).
3. **Settings > Webhooks**: add a webhook for that environment, with the URL
   `https://<your-supabase-project-id>.supabase.co/functions/v1/mux-webhook`, and copy its **Signing secret**.

Put the five values in one file per environment, named `supabase/functions/.env.staging` or `supabase/functions/.env.production`
(copy `supabase/functions/.env.example`; these files are git-ignored). Then send them to the matching Supabase project,
set up its database, and deploy the functions. Always pass `--project-ref`, so nothing goes to the wrong project:

```sh
# staging
npx supabase secrets set --env-file supabase/functions/.env.staging --project-ref pgwnqasselhstrechmsa
npx supabase db push --project-ref pgwnqasselhstrechmsa
npx supabase functions deploy --project-ref pgwnqasselhstrechmsa

# production: the same three commands with --env-file supabase/functions/.env.production
# and --project-ref fvnbcofflierdlnnglko
```

`MUX_TEST_MODE=true` (staging only) makes Mux create free test videos: watermarked, 10 seconds at most, deleted after 24 hours.
Leave it out of the production file. In each Mux environment, the webhook URL must point at that environment's own Supabase project:
`https://<project id>.supabase.co/functions/v1/mux-webhook`.

Never paste these values into chat, an issue, or a commit.

## Notifications (push and email)

Notifications go through a queue in the database. A worker (the `process-notifications` Edge Function) sends them:
push through Expo, email through [Resend](https://resend.com), honoring each person's settings (push on for everything;
email on only for matches, by default). Every email has an unsubscribe link (the `unsubscribe` Edge Function), and a
scheduled job (every 5 minutes) queues "today's question is live" for each person when their own local clock reaches
the send time (default 9:00 AM, changeable by an admin in the `app_settings` table's `daily_question_notify_time`, and
later in the admin panel). The phone reports its time zone with `set_time_zone`; until it does, a person is treated as UTC.

**Resend setup (once):** add and verify your sending domain (`catsordogs.net`) in Resend, then create an API key.
**Per environment (staging and production),** add these to that environment's file in `supabase/functions/` (see
`.env.example`): `RESEND_API_KEY`, `RESEND_FROM` (an address on the verified domain), and two long random secrets you
make up, `NOTIFICATION_WORKER_SECRET` and `UNSUBSCRIBE_SECRET` (for example `openssl rand -hex 32`; use different values
per environment). Then send the settings and deploy, as in "Connecting a Mux environment" above
(`secrets set`, `db push`, `functions deploy`).

**Tell the database where the worker is (once per environment).** In that project's SQL editor, with the same
`NOTIFICATION_WORKER_SECRET` value, run:

```sql
insert into private.worker_config (url, secret)
values ('https://<project id>.supabase.co/functions/v1/process-notifications', '<the NOTIFICATION_WORKER_SECRET value>');
```

Until this is done the scheduled job does nothing, so nothing is sent. Locally nothing is sent either (the tests use
stand-ins for Expo and Resend). Push needs real phones with a development build and Expo push credentials, which come
with the app screens.

## Workflow

One branch per build phase, one pull request per phase, merged into `main` after review.
