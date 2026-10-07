#!/bin/sh
# Runs the end-to-end tests against the LOCAL Supabase (start it first with: npm run db:start).
set -e
cd "$(dirname "$0")/../../.."
eval "$(npx supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}"
node --test supabase/tests/api/*.test.ts
