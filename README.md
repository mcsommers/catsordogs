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
| `npm run api:test` | Runs end-to-end tests through the real API as signed-in users (needs `db:start` running) |
| `cd mobile && npm start` | Starts the app (press `i` for the iOS simulator). A real phone can't reach `127.0.0.1`; use your computer's network address in `mobile/.env` instead. |
| `cd mobile && npm test` | Runs the app's tests |
| `cd mobile && npm run typecheck` | Checks the app's TypeScript for errors |

## Environments

There are three separate Supabase projects so testing never touches real users' data:

| Environment | Used for | Where its keys go |
| --- | --- | --- |
| Local | Day-to-day development (Docker) | `mobile/.env` |
| Staging | Testing with real services before release | Set when we create it (Phase 0 follow-up) |
| Production | Real users | Set before store submission |

Never commit keys or `.env` files. Only `.env.example` (with blank values) is committed.

## Workflow

One branch per build phase, one pull request per phase, merged into `main` after review.
