# Mobile app questions and answers

A record of questions asked while planning the phone app, the options offered,
and Mike's answer. Newest phase first.

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
