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

`npm run db:reset` rebuilds the local database and loads `supabase/seed.sql`: a week of past questions and
a couple of weeks of upcoming ones, so there is always a "today" question locally. The seed file is never
applied to staging or production, so those need their real questions scheduled by an admin.

## Environments

There are three separate Supabase projects so testing never touches real users' data:

| Environment | Used for | Where its keys go |
| --- | --- | --- |
| Local | Day-to-day development (Docker) | `mobile/.env` |
| Staging | Testing with real services before release | Set when we create it (Phase 0 follow-up) |
| Production | Real users | Set before store submission |

Never commit keys or `.env` files. Only `.env.example` (with blank values) is committed.

## Video (Mux)

Videos are stored, converted, captioned and streamed by Mux; our database only stores Mux's ids, the length and the captions.
Mux has its own Staging and Production environments. Use them like the Supabase ones:
**Mux Staging with Supabase Staging** (and local testing), **Mux Production only with Supabase Production**.
Do not record real users' video in Mux Production until the legal review in the Build Plan is done.

Three Edge Functions (in `supabase/functions/`) do the work: `create-video-upload` (the app asks for an upload link),
`mux-webhook` (Mux reports progress, checked against Mux's signature), and `get-playback-url` (short-lived signed links to watch).

### Connecting a Mux environment

In the Mux dashboard, with the right environment (Staging or Production) selected:

1. **Settings > Access Tokens**: create a token with permission for **Mux Video** (read and write). You get a Token ID and Token Secret.
2. **Settings > Signing Keys**: create a signing key for Video. You get a Key ID and a private key (shown once).
3. **Settings > Webhooks**: add a webhook for that environment, with the URL
   `https://<your-supabase-project-id>.supabase.co/functions/v1/mux-webhook`, and copy its **Signing secret**.

Put the five values in a file named `supabase/functions/.env` (copy `supabase/functions/.env.example`; the file is git-ignored),
then send them to the matching Supabase project and deploy the functions:

```sh
npx supabase secrets set --env-file supabase/functions/.env --project-ref <project id>
npx supabase functions deploy --project-ref <project id>
```

Never paste these values into chat, an issue, or a commit.

## Workflow

One branch per build phase, one pull request per phase, merged into `main` after review.
