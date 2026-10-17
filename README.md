# Cats or Dogs?

An authenticity-first dating app. Every day, everyone answers the same question on camera
(14 seconds by default) to unlock the feed of everyone else's answers.

Product docs and screen designs live in [`docs/`](docs/). Start with the
MVP Scope & Requirements doc. Rules for the AI coding agent are in [`AGENTS.md`](AGENTS.md).

## Project layout

| Folder | What it is |
| --- | --- |
| `mobile/` | The Expo (React Native, TypeScript) app for iOS and Android |
| `website/` | Public marketing homepage (Astro static site; design in `docs/website.pen`) |
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
| `npm run db:seed-admin` | Reloads the local admin demo people, videos, reports, and chat (needs `db:start`) |
| `npm run db:demo` | Rebuilds the local database, then loads the admin demo data |
| `npm run db:test` | Runs the database tests (rules like the daily gate live here) |
| `npm run api:test` | Runs end-to-end tests through the real API and Edge Functions as signed-in users (needs `db:start` running). Uses a stand-in for Mux, so it needs no Mux account or secrets. |
| `npm run unit:test` | Runs small tests of plain helper code (such as the caption file reader) |
| `cd mobile && npm run phone` | Starts the app for a real phone in Expo Go (see "Running the app on your phone" below) |
| `cd mobile && npm start` | Starts the app for the iOS simulator (press `i`) |
| `cd mobile && npm test` | Runs the app's tests |
| `cd mobile && npm run typecheck` | Checks the app's TypeScript for errors |
| `npm run admin` | Opens the admin website locally (run from the **repo root**; open http://localhost:5173/admin/) |
| `npm run website` | Starts the marketing homepage locally (run from the **repo root**; open http://localhost:4321) |
| `npm run website:build` | Builds the static marketing site into `website/dist/` (repo root) |
| `cd website && npm run dev` | Same dev server if you are already inside the `website/` folder |

**Marketing website setup:** `cd website && npm install`, then copy `website/.env.example` to `website/.env`. Use the same Supabase URL and anon key as `mobile/.env` (`EXPO_PUBLIC_*` → `PUBLIC_SUPABASE_*`). The download badges open a Coming Soon modal; email signups call `submit_website_launch_notify` on Supabase (run `db push` on staging after the launch-signups migration lands).

## Running the app on your phone (Expo Go)

While the app is being built, you run it on your phone with **Expo Go**, a free app that loads our app
straight from your Mac. Nothing is published to the App Store or Google Play. Your Mac acts as the server
for the app's code, so the Mac must stay on, with the command below running, while you use the app.

**Once per phone**

1. Install **Expo Go** from the App Store (iPhone) or Google Play (Android).
2. Open it once. If you have several phones, install it on each. If you sign in to Expo Go with an Expo account,
   the Mac must be signed in to the same account (next section), or Expo Go refuses to open the project.

**Once per computer:** the one-time setup above (`npm install` in the project root and in `mobile/`),
Cloudflare's free tunnel tool (`brew install cloudflared`), signing the Expo command-line tool in to your Expo
account (`cd mobile && npx expo login -b`, which opens the browser), and a
`mobile/.env` file saying which backend the app talks to. For phone testing that is **staging**:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://pgwnqasselhstrechmsa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
```

The anon key is the staging project's public app key. Print it with
`npx supabase projects api-keys --project-ref pgwnqasselhstrechmsa` (the line named `anon`), or ask the agent to fill
the file in. Don't point the app at production for testing. The local backend (`127.0.0.1`) only works on the
iOS simulator, because a phone can't reach your Mac's `127.0.0.1`.

**Each time you test**

1. Make sure your Mac and phone are online (they don't need to share a Wi-Fi network).
2. In Terminal, from the project folder:

   ```sh
   cd mobile
   npm run phone
   ```

   After a few seconds a QR code appears in the Terminal window. Leave this window open; closing it stops the app.
   Use `npm run phone`, not `npm start`. It opens a free Cloudflare tunnel, which gives the app a temporary public
   address (like `exp://some-words.trycloudflare.com/--/`, also printed above the QR code). The `/--/` part matters on
   Android. That one address works for
   iPhone and Android, on any network. `npm start` uses your Mac's home-network address (`192.168.…`) instead:
   Supabase refuses to send email links back to that, and Android phones often can't use the Mac's `.local` name.
   The tunnel address changes every time you start, so scan the new QR code each time, and request fresh email
   links after a restart (old links point at the old address).
3. Open the app on your phone:
   - **iPhone:** open the normal Camera app, point it at the QR code, and tap the "Open in Expo Go" banner.
   - **Android:** open Expo Go and tap **Scan QR code**.
4. The first load takes up to a minute while your Mac sends the app's code. After that, Cats or Dogs? opens.
   Expo Go also remembers the project under **Recently opened**, so next time you can tap it there (the Terminal
   command still has to be running).
5. When you're done, press `Ctrl + C` in the Terminal window to stop.

**Testing on two phones at once** (for example an iPhone and an Android): scan the same QR code on both. Each phone
signs in separately, so you can use a different test account on each.

**Changes to the code** show up on the phone by themselves within a few seconds. If something looks stuck, shake the
phone to open the Expo menu and tap **Reload**.

**Email links** (sign-up confirmation and password reset) must be tapped on the same phone that is running the app.
They open Expo Go and take you to the right screen. On staging these emails are sent through Resend from
"Cats or Dogs?" <noreply@catsordogs.net>, to any address, up to 30 an hour (and one per address every 30 seconds).
If one doesn't arrive, check spam.

**If it doesn't work**

| What you see | What to do |
| --- | --- |
| "Could not connect to Expo CLI" or the phone keeps loading | Check you started with `npm run phone` (not `npm start`) and scanned the QR code from this run. Don't use `npx expo start --tunnel`: Expo's built-in tunnel is currently broken (its old ngrok version is rejected). |
| **"Packager is not running at"** a `trycloudflare.com` URL (often a *different* name than the QR code shows) | Expo Go is still trying an **old** tunnel from a previous run, or Metro started on the wrong port. In the terminal running `npm run phone`, press **Ctrl+C**. Start again with `cd mobile && npm run phone` (the script now stops stale servers on port 8081). In Expo Go, open the **new** QR from this run — do not reopen a saved project or an old link. On Android, you can remove the old project from Expo Go's recent list first. |
| "cloudflared is missing" or "The Cloudflare tunnel didn't start" | Run `brew install cloudflared` once, check the Mac is online, and try again. |
| Expo Go says the project needs a newer or different version | Update Expo Go from the App Store or Google Play. This app uses Expo SDK 57. |
| "Cats or Dogs? needs your camera and microphone" | Allow both when asked. If you said no before, tap **Open Settings** in the app and turn them on for Expo Go. |
| "You're signed into Expo Go as … but not signed in to Expo CLI" | Run `cd mobile && npx expo login -b` on the Mac and sign in to the same Expo account, then restart `npm run phone`. |
| Tapping an email link says "The application couldn't be opened" | The link is from before the last restart, the server was started with `npm start`, or the link was opened on a different phone. Make sure `npm run phone` is running, then in the app use "Resend" to get a fresh link. |
| The app opens but says it can't reach the server | Check `mobile/.env` has the staging URL and key, then stop and restart `npm run phone` (changes to `.env` are read only at start). |
| App restarts by itself (Expo Go), terminal shows **"Exception in HostFunction: std::bad_alloc"** then **"Should not already be working"** | A development-only memory problem in React's debug tooling, most often on busy screens such as Review while captions generate. The app now switches that tooling off in development (`mobile/src/lib/devPerformanceGuard.ts`); store builds never had it. Reload the app once to pick it up. If it still restarts, tell the agent. |
| A red error screen | Take a screenshot and send it to the agent. Shake the phone and tap **Reload** to try again. |
| Yellow "Cannot connect to the Expo CLI" | Harmless while using `npm run phone` (the Cloudflare tunnel). It only means live hot-reload could not connect; shake the phone and tap **Reload** when you want the latest code. |
| Yellow **"WebCrypto API is not supported"** (often right after sign-up) | **Expected in Expo Go.** The phone runtime does not provide full Web Crypto; Supabase falls back and sign-up / email links still work. You can dismiss the warning and continue. It should go away only in a **development build** (not required for everyday UAT on Expo Go). |
| **"We could not start the upload. Please try again."** when you tap Record (staging) | `create-video-upload` failed talking to Mux (credentials, webhook, or Mux outage). Confirm **`MUX_TEST_MODE=false`** (or omitted) is in `supabase/functions/.env.staging` **and** pushed to Supabase with `npx supabase secrets set --env-file supabase/functions/.env.staging --project-ref pgwnqasselhstrechmsa`. In the [Mux dashboard](https://dashboard.mux.com/) (Staging environment), check for errors. Each failed tap can still add a row in the database and count toward the **recordings per day** limit even though no video was uploaded. |
| Record on iOS looks dead (button stuck on "Starting…") | Reload the app. A failed upload should show the red error above the button; if it does not, shake and **Reload**, then try again after upload errors are fixed (see row above). |
| **expo-notifications** error on Android in Expo Go | Expected: **remote push is not supported in Expo Go** (SDK 53+). The app skips push registration in Expo Go so you can keep testing everything else. To test real push (UAT **D-33**), use a **development build** ([Expo docs](https://docs.expo.dev/develop/development-builds/introduction/)). |
| **"Recording limit reached"** right after midnight or on your first try today | The limit is per **daily question**, not per clock tick. Failed starts and re-records without submitting all count. Ask the agent to check your account on staging, or wait for the next question. Also confirm the app has synced your time zone (open the app while online); until it does, "today" follows **UTC** (for US Eastern, that flips at 8 PM, not local midnight). |

On **Profile**, your sign-in **email** is shown above **Log Out** so you can tell staging test accounts apart.

The hands-on tests to run on the phone are in [`docs/UAT-flows.md`](docs/UAT-flows.md).

## Production vs staging on your phone

**Staging** is the backend you should use for everyday phone testing (the URL and anon key in `mobile/.env` above).
**Production** is the live Supabase and Mux stack for real users when the app ships. They are separate projects; see
[Environments](#environments) below.

### What “on production” can mean

| Meaning | What actually happens |
| --- | --- |
| **Database / server updated for production** | Someone ran `npx supabase db push --project-ref fvnbcofflierdlnnglko` (and related deploy steps). Production’s rules and schema change. Your phone does **not** switch unless you change `mobile/.env`. |
| **App talking to production APIs** | `mobile/.env` points at the production Supabase URL and anon key. Stop `npm run phone` and start it again so the app picks up the new values. |
| **Real production for users** | A **TestFlight, internal Android build, or store build** of Cats or Dogs? built with production keys—not Expo Go loading code from your Mac. |

### Keep phone UAT on staging

For [`docs/UAT-flows.md`](docs/UAT-flows.md) and [`docs/master-test.md`](docs/master-test.md), leave `mobile/.env` on **staging**. Staging uses the **Mux Staging** environment with **`MUX_TEST_MODE=false`**: full-length clips (up to the admin recording cap), no test watermark, and assets stay until deleted. Production (Mux Production + Supabase Production) is for launch, not day-to-day experiments.
The Build Plan also says not to record real users’ video in Mux Production until legal review is done.

### If you ever point Expo Go at production (usually don’t)

Production values look like this (anon key from `npx supabase projects api-keys --project-ref fvnbcofflierdlnnglko`):

```sh
EXPO_PUBLIC_SUPABASE_URL=https://fvnbcofflierdlnnglko.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
```

**Sign-up and password-reset emails will not work reliably in Expo Go on production.** Staging allows links that open
Expo Go (`exp://…`). Production only allows links that open the installed app (`catsordogs://auth-callback`). That is
intentional so production links cannot be hijacked into a dev shell. To exercise production auth and email end to end,
use a **development or store build** of the app, not Expo Go.

Switch back to staging in `mobile/.env` when you are done.

## Admin website

Admins run the app from a website at `/admin`: the question calendar, every setting, the review queue,
every profile (including photos), every video, and the choices on profile questions. A normal account
cannot stay signed in. There is no Create Account on this site.

One-time, from the project folder, after `npm run db:start`:

```sh
cd admin && npm install
cp .env.example .env
```

Put the local URL and the anon key from `npm run db:start` into `admin/.env`
(`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`). They are the same public values as `mobile/.env`.
Then `npm run admin` (repo root) or `cd admin && npm run dev`, and open http://localhost:5173/admin/

Sign in with the email and password of someone on the admin list. The question calendar opens on
today and the days ahead. A day ahead with no question stays in the list and is highlighted. Previous
questions are a separate view, newest first, without today or the days ahead. Today and past questions show how many people answered.
A question that has answers can open the video list for that day. The video list can also be limited to a range of dates.
The review queue can be limited to videos, profiles, or chats. Opening an item shows the hidden video, the reported profile (including photos), or the full chat. People is a sortable table (thumbnail, first name, email, followers, following, matches, answers, joined, last login). Click a row for the full profile. If tomorrow has no question, the calendar says so, and each admin gets one
email (the same notification worker as the rest of the app).

## Making yourself an admin

Nobody can make themselves an admin from the app or the website. Once you are an admin, you can make anyone else an admin (or remove another admin) from the People page: open the person's row and use **Make admin** or **Remove admin**; a confirmation window appears first. To add the very first admin, sign up in the app first
(and confirm the email; locally the message is in the email catcher at http://127.0.0.1:54324), then run this
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

To walk through every admin screen with people, videos, reports, and a chat already in place,
or to load that demo again later, start the local backend (`npm run db:start`) and from the
project folder run:

```sh
npm run db:seed-admin
```

That replaces the previous demo people (`*@local.demo`) and puts a fresh set back. It does not
touch staging or production. If the local database is in a messy state, rebuild and seed in one
step with `npm run db:demo`.

**Staging feed demo (Phase B UAT).** To fill today's feed on staging with extra demo posters (in addition to your own recording):

1. In the [staging Supabase dashboard](https://supabase.com/dashboard/project/pgwnqasselhstrechmsa/settings/api), open **Project Settings → API** and copy the **`service_role`** key (secret). It bypasses all row-level security — treat it like a root password and never commit it or paste it into chat.
2. On your Mac only, copy `supabase/.env.scripts.example` to `supabase/.env.scripts.staging` and paste the key after `SUPABASE_SERVICE_ROLE_KEY=`. That file stays git-ignored (same as `supabase/functions/.env.staging`).
3. **Do not** put the service role in `supabase/functions/.env.staging`. That file is meant for Edge Function secrets and is uploaded with `npx supabase secrets set --env-file …`, which would put the master key in the cloud.
4. Run the seed (the script refuses production):

```sh
node --env-file=supabase/.env.scripts.staging supabase/seed-staging-feed.mjs
```

Demo accounts use `@catsordogs.demo` emails. Staging uploads use normal Mux Staging assets (`MUX_TEST_MODE=false`); for playback UAT, your own submitted answer is the most reliable clip.

Then open http://localhost:5173/admin/ and sign in as `admin@local.demo` with password
`correct-horse-battery`. If you were already signed in as an older local admin, sign out first.
`visitor@local.demo` (same password) is a normal account and should be turned away.

## Environments

There are three separate Supabase projects so testing never touches real users' data:

| Environment | Supabase project | Mux environment | Video keys file | Used for |
| --- | --- | --- | --- | --- |
| Local | Docker, on your computer | A stand-in (automated tests only) | none | Day-to-day development. The app's keys go in `mobile/.env`. |
| Staging | "Cats or Dogs - Staging" (`pgwnqasselhstrechmsa`) | Staging, `MUX_TEST_MODE=false` | `supabase/functions/.env.staging` | Phone and admin UAT; full Mux assets on the paid plan |
| Production | "Cats or Dogs - Production" (`fvnbcofflierdlnnglko`) | Production, test mode off | `supabase/functions/.env.production` | Real users. No real users' video until the legal review in the Build Plan is done. |

Project IDs are not secret (they appear in the project's web address). Keys and secrets are.

Never commit keys or `.env` files. Only `.env.example` (with blank values) is committed.

## Video (Mux)

Videos are stored, converted, captioned and streamed by Mux; our database only stores Mux's ids, the length and the captions.
Mux has its own Staging and Production environments. Use them like the Supabase ones:
**Mux Staging with Supabase Staging** (and local testing), **Mux Production only with Supabase Production**.
Do not record real users' video in Mux Production until the legal review in the Build Plan is done.

Nine Edge Functions (in `supabase/functions/`) do the work: `create-video-upload` (the app asks for an upload link),
`mux-webhook` (Mux reports progress, checked against Mux's signature), `get-playback-url` (short-lived signed links to watch your own recording, or another person's answer once the daily gate is open),
`search-locations` (city suggestions while typing on the profile), `update-location` (looks up coordinates for the city on a profile, so distance works),
`process-notifications` (sends queued push and email), `unsubscribe` (the link in every email),
`delete-answer` (deletes one of your own answers and asks Mux to delete that video file),
and `delete-account` (permanently deletes the signed-in person and asks Mux to delete their videos).

### City lookup (distance)

Admin Settings has **City lookup**: **Open-Meteo** (default) or **Google Places**. The phone does not choose; both profile autocomplete (`search-locations`) and coordinate lookup (`update-location`) use whichever you pick.

- **Open-Meteo** uses the existing geocoding code. Leave `GEOCODING_URL` blank for Open-Meteo's public search, or point it at a compatible service (`?name=<city>&count=1` answering `{ "results": [{ "latitude": ..., "longitude": ... }] }`). Open-Meteo's free tier is for non-commercial use.
- **Google Places** uses Autocomplete (New) plus Place Details (New). It needs `GOOGLE_PLACES_API_KEY` as an Edge Function secret (see `supabase/functions/.env.example`). Do not put that key in the admin form. Switch the setting only after the secret is set on that environment.

City lookup server code lives only in the edge functions `search-locations` and `update-location`; your usual full `functions deploy` is enough when that code changes.

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

**`MUX_TEST_MODE`** is read by `create-video-upload` when it asks Mux for an upload link. Only the literal string `true`
turns Mux **test** assets on (watermarked, about 10 seconds max, auto-deleted after about 24 hours). This project keeps
**`MUX_TEST_MODE=false` on staging** so the master test and UAT can record without the old free-tier asset cap. Staging
still uses the **Mux Staging** API keys in `.env.staging`, not Mux Production. Leave `MUX_TEST_MODE` out of the
production file (or set it false there too). After you change the file, push secrets to Supabase (command above); the
running functions pick up the new value on the next cold start.

In each Mux environment, the webhook URL must point at that environment's own Supabase project:
`https://<project id>.supabase.co/functions/v1/mux-webhook`.

### Cleaning up staging video

Staging assets are **not** auto-deleted. Old cast recordings, failed uploads, and deleted accounts can leave clips in
Mux and rows in Supabase. When the feed looks wrong or you want to reset, open **Video → Assets** in the Mux dashboard
(Staging environment) and delete what you no longer need. Prefer keeping assets that still back a **live** answer in
Supabase staging.

**For agents:** Compare asset count in Mux with `videos.mux_asset_id` in the staging database. Assets with no live answer
are the safest to delete from Mux. Orphan or failed `videos` rows for a test user can be removed in the database when
they are blocking the **recordings per day** limit; never do this on production without an explicit request.

Never paste these values into chat, an issue, or a commit.

## Notifications (push and email)

Notifications go through a queue in the database. A worker (the `process-notifications` Edge Function) sends them:
push through Expo, email through [Resend](https://resend.com), honoring each person's settings (push on for everything;
email on only for matches, by default). Every email has an unsubscribe link (the `unsubscribe` Edge Function), and a
scheduled job (every 5 minutes) queues "today's question is live" for each person when their own local clock reaches
the send time (default 12:03 PM in each person's own time zone, changeable as Daily Question Send Time in the admin website). A separate hourly check
emails every admin if the next day has no question. The phone reports its time zone with `set_time_zone`; until it does, a person is treated as UTC. Anyone who has already answered today's
question is skipped.

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

## Email confirmation

Signing up with email does not sign the person in. They get a link. Tapping it opens the app
(`catsordogs://auth-callback`), signs them in, and lands on Build Profile (03). Password-reset links
open Set New Password (02e) the same way. Apple and Google sign-in are still later; their buttons show
"Coming soon".

**Who sends these emails:** locally they land in the email catcher (http://127.0.0.1:54324). Staging and
production send them through Resend from "Cats or Dogs?" <noreply@catsordogs.net> (set in each project under
Authentication > Emails > SMTP Settings, with that environment's `RESEND_API_KEY`), up to 30 an hour and one per
address every 30 seconds. Supabase's built-in sender is not used: it only delivers to addresses on the Supabase team.
Both projects require passwords of at least 8 characters.

This is on for the local database, staging, and production. A new email account is not signed in
until the person taps the link. The links are allowed to open the installed app
(`catsordogs://auth-callback`). Only staging also lets them open Expo Go (`exp://` addresses), which is
what makes phone testing work. Production deliberately does not, so a production link can only open the real app.

## Workflow

One branch per build phase, one pull request per phase, merged into `main` after review.
