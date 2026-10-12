# Mobile app questions and answers

A record of questions asked while planning the phone app, the options offered,
and Mike's answer. Newest phase first.

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

- **Up to 6 photos**, shown as **2 rows × 3 equal thumbnails** on every profile (own **08** and others’ **06j** / **06n**).
- Asymmetric grid or “+N more” on the sixth cell (old Pencil).
- More than 6 photos (e.g. “9 photos” in old Pencil).

Answer: **At most 6 photos** per person, displayed as **two rows of three** equal photos. No “+3” overflow tile. (Design file and requirements updated.)

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

### Scope and behavior (agent questions — answers pending unless noted)

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

## Daily gate calendar (asked Oct 12, 2026)

### When does "today" roll over for the gate?

Options:

- **UTC midnight** (what the server used at first): simple, but US evening can already be "tomorrow" on the server.
- **Local midnight** in the time zone the phone reports (same column as the daily notification). No time zone yet → UTC.

Answer: **Local midnight** for the gate, recording, feed look-back, browse "today", streaks, and nudges. Admin calendar dates stay UTC-labeled for scheduling.

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
