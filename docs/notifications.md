# Notifications catalog — Cats or Dogs?

This file is the **single index** for in-app notification types: what triggers them, who receives them, push and email copy, deep links, and what can turn them off. Product rules and screen behavior stay in the [MVP Scope & Requirements](MVP%20Scope%20%26%20Requirements%20%E2%80%94%20Authenticity-First%20Dating%20App.md) and [Build Plan](Build%20Plan%20%E2%80%94%20Authenticity-First%20Dating%20App.md). **Exact wording at send time** for several types is built in Postgres (`public.claim_notifications`); when this doc and the database disagree, fix the database and update this file in the same change.

**Not in this pipeline:** Supabase Auth mail (sign-up confirmation, password reset). Those use Auth SMTP (Resend), not `notification_outbox`.

## How delivery works

1. Server code **enqueues** a row in `notification_outbox` (or, for marketing launch signups only, calls a separate Edge Function).
2. **pg_cron** runs `private.kick_notification_worker()` every minute, which POSTs to the `process-notifications` Edge Function.
3. The worker calls **`claim_notifications`**, which applies prefs, composes final title/body for dynamic kinds, and may **skip** (cancelled match, mute, already answered, and so on).
4. The worker sends **Expo push** and/or **Resend email** (`supabase/functions/process-notifications/index.ts`). User emails include an unsubscribe link (except moderation and admin mail). User emails also include **Open in the app** when a deep link exists (`supabase/functions/_shared/notificationDeepLink.ts`).

**Scheduled enqueue jobs**

| Job | Schedule | Function |
| --- | --- | --- |
| Notification worker wake | Every minute | `private.kick_notification_worker()` |
| Daily question | Every 5 minutes | `public.enqueue_daily_question_notifications()` |
| Missing question (admins) | Hourly at :05 UTC | `public.enqueue_missing_question_alerts()` |

**Admin settings** (from `app_settings`, never hard-coded): `daily_question_notify_time` (default **12:03** local, whole minutes), `nudge_delay_minutes` (default **0**, allowed 0–60).

**User prefs (08c):** types: `daily_question`, `matches`, `messages`, `nudges`. New sign-ups get push and email **on** for all four (stored in `notification_preferences`). If a row is missing later, defaults are push on; email on **only for matches**. Types `moderation` and `admin_alert` ignore prefs (see below).

**Push registration:** installed builds register when signed in; Expo Go skips remote push on Android (SDK 53+). See README and [UAT-flows.md](UAT-flows.md) **D-33**.

**Active chat:** while **07c** is open, the client heartbeats `set_active_chat`; message **push** is skipped if the session was updated within the last **90 seconds**. Email is unchanged. See **D-33c**.

## Email unsubscribe ("Unsubscribe from these emails")

User notification mail from **`process-notifications`** uses one shared unsubscribe flow. The link turns off **email only** for a single **08c** category. It does not turn off push and does not unsubscribe from other categories in the same click.

### Which emails include the link

| Email (subject line) | `t=` query param (preference type) | **08c** row |
| --- | --- | --- |
| `Today's question is live` | `daily_question` | Daily question |
| `New match request`, `We have a match!` | `matches` | Matches |
| `New message from …` | `messages` | Messages |
| `You have been nudged` | `nudges` | Nudges |

Match request and mutual match both use **`matches`** because they share the Matches email toggle.

**No unsubscribe link:** hidden-answer mail (`moderation` / `answer_disabled`), all **`admin_alert`** mail (missing question, moderation reports), and the marketing **website launch signup** alert (separate Edge Function). Auth mail (sign-up confirmation, password reset) is out of scope for this catalog.

### What appears in the message

When the worker sends HTML email (`supabase/functions/process-notifications/index.ts`):

- Footer link text: **Unsubscribe from these emails** → signed URL (below).
- Plain-text part ends with: `You can turn these emails off any time: {url}`.
- Headers for one-click in mail clients: `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (clients may **POST** to the same URL without opening a browser).

**Open in the app** is independent; it does not perform unsubscribe.

### Link shape and security

Built in `supabase/functions/_shared/unsubscribe.ts`:

```
{PUBLIC_FUNCTIONS_URL or SUPABASE_URL}/functions/v1/unsubscribe?u={user_id}&t={type}&s={signature}
```

- **`u`:** recipient user id (UUID).
- **`t`:** `daily_question`, `matches`, `messages`, or `nudges` (same value as `notification_outbox.type` for that send). The server also accepts **`all`** in the unsubscribe handler, but outgoing notification emails always embed the **specific** type, not `all`.
- **`s`:** HMAC-SHA256 of `{user_id}.{type}` using **`UNSUBSCRIBE_SECRET`**. Guessing another person's link does not work.

### What happens when someone uses the link

1. **GET** or **POST** hits the **`unsubscribe`** Edge Function (`supabase/functions/unsubscribe/index.ts`).
2. Invalid or tampered parameters → **400**, plain text: `This unsubscribe link is not valid.`
3. Valid link → **`unsubscribe_email`** (service role only; not callable from the mobile app).
4. Database: for the given user, set **`email_enabled = false`** on `notification_preferences` for that **`t`** (or for all four types if `t=all`). **Push prefs are unchanged.**
5. **Response** depends on method:
   - **GET** (typical browser click): **302 redirect** to `https://catsordogs.net/email-unsubscribed?type={t}` (marketing site; avoids raw HTML on the Supabase function URL). That page shows the category-specific message, a note about **notification settings**, and **Open notification settings** (deep link to **08c**). Desktop copy explains using your phone.
   - **POST** (one-click unsubscribe in some mail apps): **plain text** only. Same lead sentence, then: `You can change this any time in the app's notification settings: https://catsordogs.net/notifications` (copy-paste friendly on desktop).
6. Later sends: **`claim_notifications`** reads prefs and skips email for that type until the user turns **Email** back on in **08c** (`set_notification_preference`).

Unknown user ids are handled without revealing whether the account exists.

### Notification settings web link (`/notifications`)

Marketing route **`/notifications`** (`website/src/pages/notifications.astro`) is in **apple-app-site-association** / Android app links (`website/scripts/generate-well-known.mjs`, `mobile/app.json`). The app handles `https://catsordogs.net/notifications` and `catsordogs://notifications` as **`/notifications`** (08c). User must be **signed in**; otherwise the app shows the normal auth flow first.

### Turning email back on

**Profile → Notifications (08c)** in the app, or open **`https://catsordogs.net/notifications`** on the phone with the app installed. There is no "subscribe again" control on the unsubscribe page itself beyond opening settings.

## User notification types

Push title and email subject are the same unless noted. `[Name]` is the other person's `first_name` from `profiles`.

### Daily question (`daily_question` / `daily_question`)

| | |
| --- | --- |
| **Trigger** | Cron every 5 minutes: finished profile, local calendar day equals the question's date, local time ≥ admin send time, no **live** or **disabled** answer for that question yet. |
| **Dedupe** | Once per user per question: `daily:{question_id}` |
| **Prefs** | `daily_question` (push / email) |
| **Title** | `Today's question is live` |
| **Body** | Full question text from `questions.text` (queued in outbox; not rewritten at claim) |
| **Open in app** | `https://catsordogs.net/question` |
| **Push tap** | `/question` (`mobile/src/lib/notificationNavigation.ts`) |

Product nuance (Australia and early local send time): see MVP Notifications row; implementation is `enqueue_daily_question_notifications` in `supabase/migrations/20261008010000_daily_question_local_time.sql`.

### Match request (`matches` / `match_request`)

| | |
| --- | --- |
| **Trigger** | `send_match_interest` when a **new** pending request is created (not when updating which answer was liked). Worker kicked immediately. |
| **Dedupe** | At most one notification per sender, per recipient, per **UTC day**: `match_request:{sender_id}:{utc_today}` |
| **Not sent** | Cancelled request, block, or decline (decline never notifies sender). Resend same day after cancel does not enqueue again. |
| **Prefs** | `matches` |
| **Title** | `New match request` |
| **Body** | `[Name] wants to match with you.` (`Someone` if name missing) |
| **Open in app** | `https://catsordogs.net/user/{sender_id}` (fallback `/matches`) |
| **Push tap** | `/user/{sender_id}` |

### Mutual match (`matches` / `match`)

| | |
| --- | --- |
| **Trigger** | `create_match` (mutual interest or accept path); both users enqueued. |
| **Dedupe** | Per match event (see migrations; copy resolved at claim against live match) |
| **Prefs** | `matches` |
| **Title** | `We have a match!` |
| **Body** | `You are now matched with [Name]. You can start chatting in the app immediately.` |
| **Open in app** | `https://catsordogs.net/chat/{match_id}` |
| **Push tap** | `/chat/{match_id}?justMatched=1` |

### New message (`messages` / `message`)

| | |
| --- | --- |
| **Trigger** | Each `send_message` to the other participant. |
| **Dedupe** | None (every message can queue a row). |
| **Prefs** | `messages`; per-conversation mute (`conversation_mutes`) skips at claim. |
| **Title** | `New message from [Name]` |
| **Body** | Message text, truncated to **140** characters with `…` if longer |
| **Email throttle** | At most **one message email per conversation per hour** (recent sent row with `emailed` on same `match_id`). Push not throttled. |
| **Push skip** | Active chat heartbeat (see above). |
| **Open in app** | `https://catsordogs.net/chat/{match_id}` |
| **Push tap** | `/chat/{match_id}` |

### Nudge (`nudges` / `nudge`)

| | |
| --- | --- |
| **Trigger** | First successful `nudge_user` for that target/question day; `send_after` = now + `nudge_delay_minutes`. Delay **0** kicks the worker immediately. |
| **Dedupe** | One notification row per target per question: `nudge:{question_id}` (second nudge same day only updates `nudges` count). |
| **Prefs** | `nudges` |
| **Title** | `You have been nudged` |
| **Body** | `A follower wants to hear your answer to today's question.` or `{n} followers want to hear your answer to today's question.` when **n > 1** |
| **Skipped at claim** | Target already has an answer for that question (any status counted in skip). |
| **Open in app** | `https://catsordogs.net/question` |
| **Push tap** | `/question` |

Follower identity is never included in copy or payload.

### Hidden answer (`moderation` / `answer_disabled`)

| | |
| --- | --- |
| **Trigger** | Video reaches flag threshold and is auto-disabled (`notify_answer_disabled`). |
| **Prefs** | **Cannot be turned off** (push and email forced on at claim). |
| **Title** | `Your answer was hidden` |
| **Body** | `Your answer to "{question text}" was hidden while we review reports. Nobody is told who reported it. If you think this was a mistake, contact Help & Support.` Appends admin **Help & Support URL** when set. |
| **Open in app** | None |
| **Unsubscribe** | No (safety mail) |

## Admin and operational mail (`admin_alert`)

Email only (no push). Cannot be turned off in 08c. No unsubscribe link.

### Missing question tomorrow (`missing_question`)

| | |
| --- | --- |
| **Trigger** | Hourly job when no `questions` row exists for **tomorrow** (UTC date). |
| **Dedupe** | `missing_question:{date}` per admin |
| **Title** | `No question scheduled for tomorrow` |
| **Body** | Names the date (`Month D, YYYY`) and explains the shared UTC calendar day until an admin adds a question. |
| **Skipped at claim** | Question was added before send |

### Moderation report (`moderation_report`)

| | |
| --- | --- |
| **Trigger** | New video flag, `report_profile`, or `report_message` (first report from that reporter on that target). |
| **Dedupe** | Per admin per reporter per target (keys like `moderation_report:answer:{id}:reporter:{id}`). |
| **Titles** | `Video answer reported`, `Profile reported`, or `Chat message reported` |
| **Bodies** | Name what was reported; always end with guidance to open the moderation queue; **reporters are not named**. |

See [mobile-questions.md](mobile-questions.md) (admin email on reports).

### Website launch signup (not outbox)

| | |
| --- | --- |
| **Trigger** | `submit_website_launch_notify` on the marketing site (new email). |
| **Delivery** | `website-launch-signup-alert` Edge Function via `private.dispatch_website_launch_signup_alert` (not `notification_outbox`). |
| **Recipient** | Owner inbox configured in that function (operational). |
| **Subject** | `New website launch signup` |
| **Body** | Includes the signup email and that they asked to be notified at launch. |

## What does **not** notify

- Declining a match request, cancelling an outgoing request, unmatch, block, follow, unfollow, Not Interested.
- Second match-request notification same UTC day after cancel/resend.
- Duplicate moderation report from the same reporter on the same target.

## Code map (when you change behavior)

| Area | Location |
| --- | --- |
| Queue and claim (copy, skip rules) | Latest `public.claim_notifications` in `supabase/migrations/` (e.g. `20261045000000_active_chat_suppress_message_push.sql`) |
| Enqueue: match, message | `20261009000000_matching_messaging.sql` and later replacements |
| Enqueue: nudge | `nudge_user` in `20261018000000_nudge_delay_setting.sql` |
| Enqueue: daily question | `enqueue_daily_question_notifications` in `20261008010000_daily_question_local_time.sql` |
| Worker | `supabase/functions/process-notifications/index.ts` |
| Email paths | `supabase/functions/_shared/notificationDeepLink.ts` |
| Push tap / universal links | `mobile/src/lib/notificationNavigation.ts`, `mobile/src/hooks/usePushAndNotificationLinks.ts` |
| Unsubscribe (link signing and handler) | `supabase/functions/_shared/unsubscribe.ts`, `supabase/functions/unsubscribe/`; DB `unsubscribe_email` in `20261008000000_follow_nudge_notifications.sql` |
| Automated tests | `supabase/tests/database/09_notifications.test.sql`, `10_matching_messaging.test.sql`, `08_follow_nudge.test.sql`, API tests under `supabase/tests/api/` |

## How to test

| Goal | Where |
| --- | --- |
| Screen toggles **08c** | [UAT-flows.md](UAT-flows.md) **D-32** |
| Push on device | **D-33**, **D-33c** (TestFlight / Play; not Expo Go on Android) |
| Email deep links | **D-33b**; multi-account script [master-test.md](master-test.md) (**M-13**, **M-30**–**M-32**, **M-56**, **M-67**, **M-67b**) |
| Hosting / AASA for links | [store-submission.md](store-submission.md), README **App links from notification email** |

When notification copy or triggers change, update this file, the MVP/Build Plan rows if rules changed, UAT/master-test expected results, and add or adjust a database test.
