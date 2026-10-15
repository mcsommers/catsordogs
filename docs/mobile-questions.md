# Mobile app questions and answers

A record of questions asked while planning the phone app, the options offered,
and Mike's answer. Newest phase first.

## Notification defaults at sign-up (Mike, Oct 13, 2026)

When someone creates an account, the server seeds **notification_preferences** with **push on** and **email on** for all four types (daily question, matches, messages, nudges). They can turn channels off in **08c**. Older accounts without stored rows still use the legacy fallbacks (email on only for matches).

## Text fields — focus scroll and placeholder (Mike, Oct 13, 2026)

On every text input in the mobile app **except chat**, when the user focuses the field:

1. **Placeholder / helper text inside the field clears** until they leave the field (even if the value is still empty).
2. **The screen scrolls** so the **label above the field** sits **30px** below the top of the scroll viewport (keyboard-aware when needed).

Implemented in shared `TextField`, `AppTextInput`, and `LocationField` via `FIELD_LABEL_VIEWPORT_TOP` in `mobile/src/lib/formScroll.ts`. Chat (`09` / `chat/[matchId]`) is unchanged until Mike specifies chat behavior.

### Build Profile and Edit Profile: no placeholder text (Mike, Oct 14, 2026)

On **Build Profile (03)** and **Edit Profile (08d)**, no text field shows placeholder or helper text inside it (no "Alex", no "January 1, 2000", no height numbers, no example job or school, no sample About Me line, no sample city, no "Add your own" hint). Fields are simply empty until the person types. Labels and the hints written under a field (for example the 18-or-older line under Birthday) stay. The placeholder behavior above still applies to other screens (sign up, log in, and so on).

## Phase C: Profile and archive (asked Oct 12, 2026)

Planning read-through: Build Plan Phase C, MVP requirements (profile / archive / 06j / 06k / 08), Concept doc, UAT placeholders, Pencil frames **06j**, **06n**, **06k**, **08**, and existing backend RPCs (`get_my_answers`, `get_my_profile_view_count`, `record_profile_view`, `get_answer_for_playback`, etc.).

### Design corrections (Mike, Oct 12, 2026)

#### More (⋯) button on profile hero (06j and 06n)

The agent noted a possible conflict between Pencil and an older reading of the requirements (“no more-options at the top right”).

Options:

- **Follow the design file:** Keep the **more** (⋯) and **heart** controls on the profile **hero** as drawn on **06j** and **06n** (including **06n** when the nudge card is shown).
- **Requirements-only layout:** Only bottom-right on the hero photo, with no separate top-nav more control.

Answer: **Follow the design file** — there **should** be a more button on **06j** and **06n** as designed.

#### Verified badge on profiles

Options:

- **Keep** the badge-check icon next to the name on **06j** (and similar frames).
- **Remove** — no verified-user feature in v1.

Answer: **Remove** the verified badge. That feature does not exist. (Design file updated; no badge in the app.)

#### Profile photo count and layout

Options:

- **Up to 6 gallery photos** (plus a separate **profile photo** in the hero), shown as **2 rows × 3 equal thumbnails** in **Your Photos** / **Photos** on **08** and **06j** / **06n** (avatar not in the grid).
- Asymmetric grid or “+N more” on the sixth cell (old Pencil).
- More than 6 photos (e.g. “9 photos” in old Pencil).

Answer: **One profile photo (avatar)** plus **at most 6 gallery photos**, displayed as **two rows of three** equal thumbnails in the grid. No “+3” overflow tile. (Design file and requirements updated.)

#### Build / Edit Profile photo entry (03 / 08d, Oct 2026)

On **Build Profile** and **Edit Profile**, photo entry is split: a required **Profile photo** (circular avatar, position 1) at the top, and optional **More photos** (2×3 grid for gallery positions 2–7) above the primary button. Viewing profiles (**06j**, **08**) shows the avatar in the hero and **only gallery photos** in the grid.

#### Gender on Build / Edit Profile (03 / 03d / 08d, Oct 2026)

Gender used to offer Woman, Man, and Non-binary only. Decided: **Woman**, **Man**, and a **More >** chip that opens a separate **Gender** screen (**03d**) with 30 single-choice options (Agender through Two-Spirit; full list in the MVP requirements). The **More** chip shows the chosen value (truncated if long) once picked, and tapping it reopens **03d**. A **Show gender on my profile** switch sits under the chips, **on** by default; when off, other people do not see the gender, but it still counts for matching and the Show me filter. Everything chosen from More fails both Show me: Women and Show me: Men (see `feed-rules.md`). One **03d** screen serves both Build Profile and Edit Profile. Design, requirements, Build Plan, feed rules, and UAT (A-20, A-20b, A-20c, D-31c) are updated; database and app code are not yet.

#### Sexual orientation on Build / Edit Profile (03 / 08d, Oct 2026)

Decided: the chips are now Straight, Gay, Lesbian, Bisexual, Asexual, Demisexual, Pansexual, Queer, Questioning (replacing Straight, Gay, Bi-Sexual, Questioning), still optional, but now **single-select** (header "Optional · Choose one"; the earlier "select all that apply, up to 5" is removed). **Lesbian** is a plain option: it is not linked to Show me or Interested in (decided Oct 2026). A **Show orientation on my profile** switch (default on, same wording and rule as the gender switch) sits under the chips; hidden orientation still counts for the Sexual orientation filter. Database and app code are not yet updated (UAT A-20, A-20d).

#### Interests replace Lifestyle on Build / Edit Profile (03 / 03e / 08d, Oct 2026)

Decided:

- The **Lifestyle** section is now **Interests**. An empty section shows one **Select Interests >** pill; it opens screen **03e**, which lists all 278 interests as pills in strict alphabetical order. Up to 5 can be chosen, with a live "N of 5 selected" counter.
- **Done** on 03e stays disabled until something on that screen has changed. Leaving 03e with unsaved changes shows the existing **Discard changes?** dialog.
- After Done, the picks show as orange selected pills with an orange **Edit** link in the section header.
- The 5 picks **replace** the old hobby list in the `interests` column, and feed the Shared Interests ranking (the Interests filter was removed; see below).
- Lifestyle tags are removed. So are the **Smoking** and **Drinking** filters and the **Lifestyle Compatibility** ranking signal (Feed Settings, 06i, now has five ranking signals). Every screen that said "Lifestyle" now says "Interests".
- The top row (back arrow and "N of 5 selected") is sticky, and the space above **Done** equals the space below it (Pencil 03e and 03e Edited updated). The top row has 12 points of space above and below it. On Android the gap above **Done** is 24 points and does not include the phone's navigation bar; on iPhone it matches the gap below (which includes the home indicator).
- **Done** is always visible: it is pinned at the bottom of 03e while the pill list scrolls above it (Pencil 03e and 03e Edited now show a phone-height screen with the list clipped and Done fixed at the bottom). The list is strictly alphabetical, ignoring capitals, so acronyms sort by their letters (BBQ falls after Basketball and before Beach Bars; DIY after Diving; EDM after E-Sports); the order is stored in `profile_options.sort_order` and the Pencil pills match it. When 5 are chosen, tapping another unselected pill does nothing.

#### Photo count row on **06j** and **06n** (removed)

The Pencil headers had **“6 photos ›”** (count + chevron) above the grid even though all photos are already visible.

Options:

- **Keep** the count row as a shortcut to a gallery screen.
- **Remove** the count/chevron on **06j** and **06n**; keep only the **Photos** section title (or title + grid).

Answer: **Remove** the **“6 photos ›”** row on **06j** and **06n**. No separate “see all” affordance — the grid is complete.

#### Full-screen photo viewer (**06ja**)

Someone else’s profile needs a dedicated screen to view photos large.

Options:

- **Tap a thumbnail** on **06j** / **06n** → full-screen viewer (**06ja**) starting at that photo; **back arrow** or **X** returns to the profile. Swipe horizontally to move between photos (standard gallery).
- Tap only opens a single photo with no paging.
- Inline zoom on the grid without a new screen.

Answer: **New screen 06ja Profile Photos** (frame to the right of **06j**). Tapping any thumbnail on **06j** / **06n** opens **06ja** at that photo.

**06ja behavior (Mike, Oct 12, 2026 — updated):**

- **Dismiss:** **Back** arrow **upper left**; tap returns to the profile (**06j** / **06n**). No **X**. No back control at the bottom of the screen.
- **Page indicator:** **“1 of 6”** (current index and total) centered **below the image**, not at the very bottom of the phone chrome.
- **Default view:** Show the **whole photo** (resize to fit — no crop). **Center** the image vertically in the viewport; letterboxing/pillarboxing as needed.
- **Zoom:** **Two-finger pinch** to zoom in or out.
- **Pan:** After zooming in so the image is **clipped**, **one-finger drag** pans within the image.
- **Change photo:** Swipe **up** or **right** → **next** photo; swipe **down** or **left** → **previous** — incoming photo **slides horizontally** with the gesture (when not conflicting with pan/zoom; implement so paging and zoom/pan feel natural).

#### Other users can see profile photos

Today only the **avatar** (first photo) is readable from storage by other signed-in users; photos 2–6 were owner-only.

Options:

- **Update the backend** so **all profile photos** (positions 1–6) are visible to other users when viewing a profile (still subject to block rules and finished-profile checks).
- **Avatar only** on others’ profiles until a later phase.
- **Signed URLs** per photo via a new API without changing storage policy.

Answer: **Update the backend** so profile photos are **visible to other users** when they view a profile. Implement in Phase C with server tests (storage policy and/or RPC, aligned with blocks).

---

### Scope and behavior (agent questions — answered Oct 12, 2026)

Reply with the **question number and option letter**, e.g. **1A**, **3B**. For question **2**, you can pick one letter for heart/⋯ and one for nudge (e.g. **2A** and **2D**).

#### 1. Own Profile tab (08) vs Phase D Account rows

Options:

- **A.** Build **08** and **06j** for browsing (stats, archive, view counts). Show Account rows (Edit Profile, Feed Settings, Notifications, Privacy, Blocked list) as designed; taps show **“Coming in the next update”** until Phase D. **Log Out** stays working. *(Recommended.)*
- **B.** Only **Log Out** on Profile tab in Phase C; hide other Account rows until Phase D.
- **C.** Include **08d Edit Profile** in Phase C.

Answer: **1A.**

#### 2. Heart, ⋯ actions, and nudge on others’ profiles

Options (heart / ⋯):

- **A.** **Placeholders** on heart and ⋯ (like Phase B feed) until Phase D wires follow, match, report, block.
- **B.** **Wire heart** to `get_match_state` / send–cancel in Phase C.

Options (nudge on **06n**):

- **C.** Build **06n** nudge card and **06o** confirmation in Phase C.
- **D.** **Defer** nudge UI to Phase D.

Answer: **2A** (heart and ⋯ placeholders until Phase D). Nudge (**06n** / **06o**) deferred to Phase D with the rest of social actions.

#### 3. Feed locked — viewing someone else’s profile and answers

Options:

- **A.** Show profile and answer list but **block playback** with a clear message until today’s gate is open.
- **B.** **Hide** their answers until the gate opens.
- **C.** Only allow opening others’ profiles from the **unlocked feed** in Phase C.

Answer: **3A.**

#### 4. “See all” on 08 (Your Answers)

Options:

- **A.** Scroll the **same screen** to the full archive section.
- **B.** Open a **dedicated full-archive screen** (not a separate Pencil frame today).
- **C.** **Drop “See all”** — one long timeline on **08** only.

Answer: **4B.** Tapping **See all** on **08** opens a dedicated screen **08a Your Answers** (designed to the right of **08** in Pencil): back returns to **08**; scrollable list of all the user’s answers (newest first), same row style as the profile archive, with view counts on thumbnails. **Lazy-load** older rows as the user scrolls.

#### 5. 06k answer-to-answer paging

Options:

- **A.** Same **unified vertical page scroll** as the feed (`docs/mobile-feed-scroll.md`).
- **B.** Simpler full-screen player + swipe as long as chrome moves with the video.

Answer: **5A** (unified vertical page scroll per `docs/mobile-feed-scroll.md`).

**Other person’s profile archive (06j, 06n, 07h, etc.) — Mike, Oct 12, 2026:** On profiles such as **07h** (and the same pattern on **06j** / **06n**), the user can **keep scrolling** the main profile to see **all** of that person’s previous answers, not just the first few rows. Use **lazy loading** (fetch/render more as they scroll) for performance.

#### 6. Disabled answers on your own profile (08)

Options:

- **A.** Still **list** disabled answers with a hidden/disabled state.
- **B.** **Omit** disabled answers from the list.

Answer: **6A** (list disabled answers with a hidden/disabled state).

#### 7. Git branch for Phase C

Options:

- **A.** **`phase-c-profile`** branch and one PR into `main` when done (same as earlier phases).
- **B.** Use a different branch name (say which in your reply).

Answer: **7A.**

**Implementation note:** Phase C checkboxes are in `docs/UAT-flows.md` (updated when Mike answered these questions).

---

## Phase D: Social screens (asked Oct 12, 2026)

Planning read-through: Build Plan Phase D (“Follow, nudge, match, messages, filters, settings, the more-options menu … Blocked and Not Interested list with Unblock and Undo, flagging”), MVP requirements (matching, messaging, follow/nudge, moderation menus, Feed Settings **06i**, Account **08b–08g** / **08d** / **08c**, per-video flag vs profile/message report), Pencil frames **07** (Incoming / Outgoing / Chats segments), **07b–07n**, **07h**, social confirmations **06b**, **06e–06w**, **06i**, **06n** / **06o**, **06z**, and Account **08b–08g** / **08d** / **08c**.

**Code today:** The Matches tab is still a placeholder (`mobile/src/app/(tabs)/matches.tsx`). Heart and ⋯ on the feed, **06j** / **06n**, and **06k** call `phaseDPlaceholder.ts`. **08** Account rows use the same placeholder. The feed already loads `matchState` / `isFollowed` on items; profiles use `get_user_profile` (includes `matchState`). Server RPCs for follow, nudge, match, chat, block, Not Interested, flag, report, filters, ranking, notification prefs, and blocked lists are already in Supabase with tests — the mobile app has not wired them yet. There is no Expo push token registration in the app yet (notifications are queued on the server).

Reply with the **question number and option letter**, e.g. **1A**, **4B**.

**Mike (Oct 12, 2026):** **1A**, **2A**, **3A**, **4A**, **5A**, **6A**, **7A**, **8A**, **9A**, **10A**, **11A**, **12A**.

### 1. How much should Phase D ship in one pull request?

The Build Plan names one mobile Phase D with “every remaining user-facing screen” before Polish (Phase E). That is a large surface (matches, chat, menus, Feed Settings, full Account section, flag/report).

Options:

- **A.** **One Phase D PR** on branch `phase-d-social`: everything in Build Plan Phase D in a single phase (matches through Account), then UAT for all of it together. *(Recommended if you want one big test pass.)*
- **B.** **Two PRs:** **D1** — heart, ⋯ menus, follow/nudge (**06n** / **06o**), match flow, **07** tab, chat, and confirmations; **D2** — **06i** Feed Settings, **08d** / **08b** / **08c** / **08e–08g**, Help & Support, delete account.
- **C.** **Three PRs:** match/chat first, then social menus + follow/nudge, then settings + Account.

Answer: **1A.**

### 2. Matches tab layout (Pencil **07**, **07b**, **07e**)

Pencil shows one **Matches** screen title with three segments at the top: **Incoming**, **Outgoing**, and **Chats** (with separate frames for Incoming vs Outgoing list content and **07b** for Chats).

Options:

- **A.** **Match Pencil:** one Matches tab route with those three segments; switching segments swaps the list (Incoming requests, Outgoing requests, or Chats). *(Recommended.)*
- **B.** **Chats only** on the Matches tab; Incoming and Outgoing live only inside notifications / deep links (not in Pencil).
- **C.** **Something else** — describe in your reply.

Answer: **2A.**

### 3. Where should Accept and Decline live?

Requirements: the recipient can **View Profile**, **Accept (on the sender’s profile, 07h)**, or **Decline**. Pencil **07** Incoming rows include **Decline** (with **07g**); **07h** shows **Accept**.

Options:

- **A.** **Both places as designed:** Decline from the Incoming row (confirmation **07g**); Accept only on **07h** (and heart/send rules unchanged elsewhere). *(Recommended.)*
- **B.** Accept and Decline both on the Incoming row; profile is view-only.
- **C.** Accept and Decline only on **07h** after tapping the row.

Answer: **3A.**

### 4. After sending a match request from a **profile** (heart on **06j** / **06n**)

Pencil has **07i Match Confirmation** and a separate frame **06z Profile Request Sent** (in addition to feed **06b** for “Match with [name]?” before send).

Options:

- **A.** **Before send:** same pattern as the feed — confirmation dialog (**07i** on profile, **06b** on feed / **06k**). **After** a successful send, show **06z** (or equivalent success state on the profile), then selected heart everywhere.
- **B.** **Before send only** (07i / 06b); no **06z** — heart state alone shows “request sent”.
- **C.** **06z only** after send; no separate pre-send dialog on profile (feed still uses **06b**).

Answer: **4A.**

### 5. Expo push registration and **08c Notifications**

Match requests, messages, nudges, and daily question pushes need a device token. The server queue and worker already exist; the app does not register for push yet.

Options:

- **A.** **Include in Phase D:** request OS permission when appropriate, register the Expo push token with Supabase, and build **08c** so push/email toggles call `get_notification_preferences` / `update_notification_preferences`. *(Recommended for testing real notifications.)*
- **B.** **Build 08c toggles only** (server prefs) but **defer** device registration and OS permission to Phase E; you test social flows without push on the phone.
- **C.** **Defer all of 08c** to Phase E; Phase D is in-app only.

Answer: **5A.**

### 6. Feed Settings (**06i**) — how complete in Phase D?

Requirements: full **Filters** (driven by `filter_definitions`, not hard-coded) plus **Ranking** weights and **reset**, and saving must affect `get_feed` / ranking on the server.

Options:

- **A.** **Full 06i in Phase D** — every filter and all three ranking sliders (six before Oct 2026), wired to `filter_preferences`, `feed_settings`, and `reset_feed_settings`, opened from the feed settings control and from **08** Account. *(Recommended; matches MVP.)*
- **B.** **Ranking section first** in one PR, Filters in a follow-up (same phase, two steps).
- **C.** **Filters only** in Phase D; Ranking stays at server defaults until a follow-up.

Answer: **6A.**

### 7. Account screens beyond placeholders

**08** already lists Edit Profile, Feed Settings, Notifications, Privacy & Safety, Blocked and Not Interested, and Help & Support (all placeholder except Log Out).

Options:

- **A.** **Wire every Account row in Phase D** per MVP: **08d** Edit Profile (reuse Build Profile fields + Save Changes), **08b** Privacy & Safety (Allow followers + Delete account), **08c** Notifications, **08e–08g** Blocked and Not Interested list, **06i** from Feed Settings row, Help & Support opens the admin **Help URL** when set. *(Recommended.)*
- **B.** **Social + 06i + Blocked list only**; defer **08d**, **08b** (delete account), and **08c** to Phase E.
- **C.** **Delete account** and **Help & Support** only after you approve copy/design for delete (superseded by **8A** / **08h**).

Answer: **7A.**

### 8. Delete account confirmation (**08h**)

MVP requires immediate permanent deletion after a single confirmation step on screen **08h** (designed in Pencil to the right of **08g**).

Options:

- **A.** **Add a simple frame to Pencil** (e.g. next to **08b**) as part of Phase D, then build it to match.
- **B.** **Build from requirements copy** in a minimal alert/full-screen flow **without** a new Pencil frame for now.
- **C.** **Defer delete account** to Phase E; Privacy & Safety ships **Allow followers** only in Phase D.

Answer: **8A.** New Pencil frame **08h Delete Account Confirmation** (to the right of **08g**).

### 9. Feed ⋯ menu: **Report** on a video vs a profile

The menu label is always **Report**, but MVP distinguishes **per-video flagging** on feed / answer view (flag copy about the **response**) from **profile report** on **06p** (profile report queue).

Options:

- **A.** **Context-specific behavior (recommended):** on feed **06e** and **06k**, **Report** calls `flag_answer` and uses the flag confirmation copy; on **06p** (profile), **Report** calls `report_profile` and uses the profile report copy. Menu order stays Follow / Not Interested / Report / Block / Cancel everywhere.
- **B.** **One Report path** for both (always profile report) — only if you intend to change MVP.
- **C.** **Rename** feed menu item to “Flag” while keeping “Report” on profiles (would diverge from Pencil **06e**).

Answer: **9A.**

### 10. Per-chat mute (**07d**) and message report (**07m**)

Pencil includes **07d Mute Notifications Confirmation** (chat header bell) and **07m Report Message Confirmation** (flag icon in header).

Options:

- **A.** **Build both in Phase D** with the server behavior that matches chat notification prefs / `report_message`. *(Recommended.)*
- **B.** **Chat text + Realtime first**; mute and message report in a fast follow-up before you call Phase D done.
- **C.** **Skip 07d** in v1 (always notify for messages when prefs allow).

Answer: **10A.**

### 11. Git branch for Phase D

Options:

- **A.** **`phase-d-social`** branch and one PR into `main` when the scope you chose in question **1** is complete. *(Recommended.)*
- **B.** Use a different branch name (say which in your reply).

Answer: **11A** — use git branch **`phase-d-social`** and one pull request into `main` when Phase D is complete.

### 12. What should you UAT first on your phone?

Once implementation starts, order affects what you can validate early.

Options:

- **A.** **Menus + heart first** (follow, block, Not Interested, report/flag, match send/cancel), then Matches tab + chat, then **06i** + Account.
- **B.** **Matches + chat first**, then menus and settings.
- **C.** **No preference** — agent orders by dependency and documents the sequence in the Phase D UAT section.

Answer: **12A** — test **menus + heart** first (follow, block, Not Interested, report/flag, match send/cancel), then **Matches tab + chat**, then **06i** + Account. Checklist: `docs/UAT-flows.md` (**D-01** through **D-38** in that order).

**Implementation note:** Phase D builds on branch **`phase-d-social`** (**11A**), one PR (**1A**). Exact button copy in UAT is verified against the app when Phase D is implemented.

---

## Daily gate calendar (asked Oct 12, 2026)

### When does "today" roll over for the gate?

Options:

- **UTC midnight** (what the server used at first): simple, but US evening can already be "tomorrow" on the server.
- **Local midnight** in the time zone the phone reports (same column as the daily notification). No time zone yet → UTC.

Answer: **Local midnight** for the gate, recording, feed look-back, browse "today", streaks, and nudges. Admin calendar: follows the signed-in admin's local day (decided later, Oct 2026); it is not tied to the players' days.

## Feed unified page scroll (asked Oct 12, 2026)

### When the user swipes between feed videos, what moves?

Options:

- **Fixed HUD:** video changes underneath; chrome (pill, mute, captions, actions) stays pinned on screen.
- **Unified page (recommended):** each answer is one full-screen page; video and all chrome scroll away together vertically (TikTok-style pager).

Answer: **Unified page.** Locked for implementation in `docs/mobile-feed-scroll.md` and AGENTS.md rule 6. Any feed UI work must keep `FeedOverlay` inside the paging list row, not a sibling overlay above the list.

## Phase B: Feed and browse (asked Oct 11, 2026)

### 1. How much should Phase B include beyond the core video feed?

The **Build Plan** names Phase B as: scrollable feed, minimum watch time,
captions, and followed-first display. The **requirements** also describe Browse
Questions (06c/06d), the Question Pill, rolling to earlier days (06u), a day-change
banner, the "You're all caught up" end screen (06v), and streak badges on feed
videos. **Phase D** is where heart (match), the more-options menu (follow, report,
block, Not Interested), and Feed Settings (06i) live.

Options:

- **Core only:** Today's feed (06): full-screen videos, captions, skip after
  minimum watch, followed section looks distinct, Question Pill. Defer browse,
  day rollover, end screen, and streak badge to a fast follow-up.
- **Feed + browse (recommended):** Everything in core, plus Browse Questions and
  search (06c/06d), opening a past day's feed, day rollover (06u) with banner,
  and 06v when caught up. Buttons on 06v can open Browse; "Adjust Feed Settings"
  can show "Coming in a later update" until Phase D.
- **Full feed UX in one phase:** All of the above plus streak badges on each
  video and visible (but non-functional or "coming soon") heart and more-options
  chrome so the layout matches 06 before Phase D wires them up.

Answer: Full feed UX in one phase — all of the above plus streak badges and heart/more-options chrome visible (wired up in Phase D).

### 2. When someone taps the poster's name or photo on a feed video, what should happen in Phase B?

Full profile and archive are **Phase C**. The feed design shows name, age, and
distance on each video.

Options:

- **Nothing yet:** Name and photo are display-only until Phase C.
- **Placeholder:** Open a simple "Profile coming soon" sheet so taps feel intentional.
- **Start Phase C early:** Build the other person's profile (and archive entry)
  in the same branch as Phase B.

Answer: Placeholder — open a simple "Profile coming soon" sheet so taps feel intentional.

### 3. Sound on the feed?

The requirements call for muted autoplay on the feed for fast scanning.

Options:

- **Muted by default** with a tap-to-unmute control on each video (recommended).
- **Sound on by default** (user can mute in the player if we add a control later).
- **Always muted** in Phase B (no unmute button yet).

Answer: Muted by default with a tap-to-unmute control on each video.

### 4. Staging feed testing — who supplies the videos?

To scroll the feed on a phone you need several **live answers** for today's
question (and optionally past days) on staging.

Options:

- **Mike and helpers:** You and anyone testing create real accounts and submit
  answers; I only document the steps in UAT.
- **Agent seeds staging:** I add a safe staging-only SQL or admin script that
  creates a handful of demo profiles and answers (no production data).
- **Both:** Seed demos for a busy feed, and UAT still walks through recording a
  real answer on a fresh account.

Answer: Both — seed demos for a busy feed on staging, and UAT still walks through recording a real answer on a fresh account.

## Phase A: Onboarding and core loop (asked Oct 10, 2026)

### 1. How should Mike test Phase A on his phone?

Recording and captions only fully work against staging. On the local computer,
the video service cannot tell the local database a video finished processing,
and there are no real captions. This Mac has no Xcode or Android Studio, so
testing is on a real phone with Expo Go.

Options:

- Point the phone app at staging while testing Phase A; keep local for automated tests. (Recommended)
- Keep the phone on the local computer, and accept that recordings won't finish processing there.
- Install Xcode first so the iPhone simulator can also be used (it has no camera).

Answer: Point the phone app at staging while testing Phase A; keep local for automated tests.

### 2. What should Sign Up show for Apple and Google sign-in for now?

Apple and Google sign-in need accounts only Mike can set up (an Apple Developer
account and a Google sign-in setup).

Options:

- Email only for now; hide the Apple and Google buttons until those accounts exist. (Recommended)
- Show the Apple and Google buttons, marked as coming soon.
- Build them now; Mike creates the Apple and Google accounts during this phase.

Answer: Show the Apple and Google buttons, marked as coming soon.

### 3. What should happen about the missing Log In screen?

Welcome (01) has a Log In button, but there is no designed Log In screen and no
forgot-password screen.

Options:

- Design a Log In screen in the Sign Up style, with "Forgot password?" that emails a reset link, add both to the design file, then build them. (Recommended)
- Design and build Log In only; skip forgot password for now.
- Wait. Mike designs Log In first.

Answer: Design a Log In screen in the Sign Up style, with "Forgot password?" that emails a reset link, add both to the design file, then build them.

### 4. Where should "View Today's Feed" (05c) and the app's main screen go for now?

The feed itself is Phase B.

Options:

- Build the Feed / Matches / Profile tab bar now. Feed shows Feed Locked (06m) or a plain "feed arrives next phase" note; Matches and Profile are plain placeholders. (Recommended)
- After submitting, go back to the temporary test screen for everything else.

Answer: Build the Feed / Matches / Profile tab bar now. Feed shows Feed Locked (06m) or a plain "feed arrives next phase" note; Matches and Profile are plain placeholders.

### 5. What should be done about the three undesigned states?

The states: captions still being made or no speech found (on 05 and 05b), no
question scheduled today, and under-18 or other save errors on Build Profile.
All three are listed as open in the requirements doc.

Options:

- Design simple versions in the design file, update the requirements doc, then build them. (Recommended)
- Build plain text messages for now, without designing them.
- Show Mike each one before building it.

Answer: Design simple versions in the design file, update the requirements doc, then build them.

## Feed Settings: Specific shared interests (Oct 2026)
- Shared Interests has a 4th option, **Specific**. Choosing it shows a **Choose specific interests** row (with "N selected") that opens screen **06ia**, a dark screen with all 278 interests as pills, no limit, a live "N selected" counter, and a pinned **Done** button (disabled until something changes; same spacing as 03e). Leaving with unsaved changes shows the **Discard changes?** dialog. Done hands the picks to Feed Settings; they are saved with its **Save** button. Unselected pills on dark screens are black with a white outline and white text.
- The long list of Interest pills is gone from Feed Settings, and so is the **Interests** filter (a hard filter on interests overlapped with this ranking choice). Interests now only affect ranking. *Assumption, confirm.*
- Specific weighs 6 (Low 1, Medium 2, High 3). The score is matches / the smaller of (number picked, 3), capped at 1, so any 3 matches is a full score. Specific with nothing picked goes back to the previous setting (Medium if it was already Specific). *Decided by Mike.* The first three are also confirmed.
- **Maximum distance filter removed (Oct 2026).** Distance only affects the order through the Distance ranking signal. Saved maximum-distance values were cleared.
- **Relationship goals filter removed; Age range and Height are sliders (Oct 2026).** Age range is a two-handle slider, 18 to 70+; Height is a two-handle slider, 2'0" to 7'0"+. A handle on the far end means no limit on that side (so 70+ includes everyone older), and both handles on the ends is the same as Any. Relationship goals still affect the order through the ranking signal.
- **Occupation filter removed; Sexual orientation moved above Age range (Oct 2026).** Filter order is Show me, Sexual orientation, Age range, Height.
