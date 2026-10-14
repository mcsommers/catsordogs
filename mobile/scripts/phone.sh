#!/usr/bin/env bash
# Serves the app to Expo Go on any phone through a free Cloudflare tunnel.
# A tunnel gives the server a public name: Android can't look up the Mac's .local name,
# and Supabase won't send email links back to a 192.168.x.x address.
set -euo pipefail
cd "$(dirname "$0")/.."

# Metro must use 8081 — cloudflared forwards that port. A leftover server on 8081
# makes Expo offer 8082 while the tunnel still hits the stale process (packager errors).
if lsof -ti :8081 >/dev/null 2>&1; then
  echo "Stopping an old dev server on port 8081..."
  lsof -ti :8081 | xargs kill 2>/dev/null || true
  sleep 1
fi

if ! command -v cloudflared >/dev/null; then
  echo "cloudflared is missing. Install it once with: brew install cloudflared"
  exit 1
fi

log=$(mktemp)
cloudflared tunnel --no-autoupdate --url http://localhost:8081 >"$log" 2>&1 &
tunnel=$!
trap 'kill $tunnel 2>/dev/null; rm -f "$log"' EXIT

url=""
for _ in $(seq 1 30); do
  url=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1 || true)
  [ -n "$url" ] && break
  sleep 1
done
if [ -z "$url" ]; then
  echo "The Cloudflare tunnel didn't start. Check the internet connection and try again."
  cat "$log"
  exit 1
fi

host="${url#https://}"
# The /--/ segment tells Expo Go to open the app entry screen, not a mystery route (Android needs this).
open_url="exp://${host}/--/"
echo
echo "Open in Expo Go: $open_url"
echo
EXPO_PACKAGER_PROXY_URL="$url" npx expo start --port 8081
