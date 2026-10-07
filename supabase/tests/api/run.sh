#!/bin/sh
# Runs the end-to-end tests against the LOCAL Supabase (start it first with: npm run db:start).
#
# It also starts the Edge Functions with TEST-ONLY Mux settings (a throwaway
# signing key made fresh each run, and a stand-in for Mux), so these tests never
# touch a real Mux account and need none of your real secrets.
set -e
cd "$(dirname "$0")/../../.."
eval "$(npx supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}"

WORK="$(mktemp -d)"
FAKE_MUX_PORT=54399
FAKE_GEOCODER_PORT=54398
FAKE_NOTIFY_PORT=54397
openssl genrsa -out "$WORK/key.pem" 2048 2>/dev/null
openssl rsa -in "$WORK/key.pem" -pubout -out "$WORK/pub.pem" 2>/dev/null
export MUX_WEBHOOK_SECRET="test-webhook-$(openssl rand -hex 16)"
export MUX_TEST_PUBLIC_KEY="$(cat "$WORK/pub.pem")"
export FAKE_MUX_PORT FAKE_GEOCODER_PORT FAKE_NOTIFY_PORT
export NOTIFICATION_WORKER_SECRET="test-worker-$(openssl rand -hex 16)"
export UNSUBSCRIBE_SECRET="test-unsub-$(openssl rand -hex 16)"

cat > "$WORK/functions.env" <<ENV
MUX_TOKEN_ID=test-token-id
MUX_TOKEN_SECRET=test-token-secret
MUX_WEBHOOK_SECRET=$MUX_WEBHOOK_SECRET
MUX_SIGNING_KEY=test-signing-key-id
MUX_PRIVATE_KEY=$(base64 < "$WORK/key.pem" | tr -d '\n')
MUX_BASE_URL=http://host.docker.internal:$FAKE_MUX_PORT
MUX_STREAM_BASE_URL=http://host.docker.internal:$FAKE_MUX_PORT/stream
MUX_IMAGE_BASE_URL=http://host.docker.internal:$FAKE_MUX_PORT/image
GEOCODING_URL=http://host.docker.internal:$FAKE_GEOCODER_PORT/v1/search
NOTIFICATION_WORKER_SECRET=$NOTIFICATION_WORKER_SECRET
UNSUBSCRIBE_SECRET=$UNSUBSCRIBE_SECRET
RESEND_API_KEY=test-resend-key
RESEND_FROM=Cats or Dogs? <noreply@catsordogs.net>
RESEND_BASE_URL=http://host.docker.internal:$FAKE_NOTIFY_PORT/resend
EXPO_PUSH_URL=http://host.docker.internal:$FAKE_NOTIFY_PORT/expo/push/send
PUBLIC_FUNCTIONS_URL=$API_URL/functions/v1
ENV

cleanup() {
  [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null || true
  docker rm -f supabase_edge_runtime_cats-or-dogs >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

npx supabase functions serve --env-file "$WORK/functions.env" > "$WORK/functions.log" 2>&1 &
SERVE_PID=$!

echo "Starting Edge Functions..."
i=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$API_URL/functions/v1/get-playback-url")" = "200" ]; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "Edge Functions did not start. Log:"; cat "$WORK/functions.log"; exit 1
  fi
  sleep 1
done

# One test file at a time: some tests change shared settings.
node --test --test-concurrency=1 supabase/tests/api/*.test.ts
