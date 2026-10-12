# UAT Flows — Cats or Dogs? Mobile App

User acceptance tests (UAT) are hands-on checks you run on a real phone to confirm the app works the way the requirements and designs say it should. Automated tests already cover the server rules; these cover what a person actually sees and does.

Each mobile phase (A through E) adds its own section below when it is built. Screen numbers (02b, 04f, and so on) match the frames in `docs/pencil-new.pen` and the requirements doc, so you can compare the phone against the design.

Tick each box when the result matches. If something doesn't match, note the test ID (for example A-07) and what you saw, and the agent will fix it.

## Before you start (every phase)

1. **Expo Go on your phone.** Install it from the App Store or Google Play. It runs the app straight from your Mac without publishing it.
2. **Start the app.** Ask the agent to start it, or run `cd mobile && npm run phone` yourself (not `npm start`, or email links can't reopen the app). Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android). The address changes each time the server restarts, so rescan, and ask for a fresh email link if one was sent before the restart. Full steps and troubleshooting are in the README, under "Running the app on your phone (Expo Go)".
3. **Staging, not production.** The app on your Mac points at the staging backend ("Cats or Dogs - Staging"). Nothing you do here touches real users.
4. **Test accounts.** Use a fresh email for each "new user" test. With Gmail, `you+uat1@gmail.com`, `you+uat2@gmail.com` and so on all arrive in your normal inbox but count as different accounts.
5. **Open email links on the phone.** Confirmation and password-reset links must be tapped on the same phone that is running Expo Go, so they open the app.
6. **Settings you can't change from the phone** (recording length, recordings per day, whether today has a question): ask the agent to change them on staging for the test, and to put them back afterwards.
7. **Staging videos are test videos.** Staging uses the video service's free test mode: playback is watermarked and cut to 10 seconds, and videos are deleted after 24 hours. That is expected on staging and not a bug.

---



## Phase A — Onboarding and core loop

Covers: Welcome (01), Sign Up (02), Log In (02b), Forgot Password (02c), Check Your Email (02d), Set New Password (02e), Build Profile (03) and its errors (03c), How It Works (03b), Today's Question (04, 04d, 04e), Skip (04 dialog), Daily Limit Reached (04f), No Question Today (04g), Review & Submit (05, 05d, 05e), Edit Captions (05b), Answer Submitted (05c), Feed Locked (06m), and the tab bar. Matches and Profile are placeholders until Phases C and D. The scrollable video feed is Phase B (see below).

### Sign up and email confirmation

- [ ] **A-01 Welcome screen.** Open the app for the first time. Expected: the Welcome screen (01) with the app name, "Pick your pack", a **Get Started** button and a **Log In** link.
- [ ] **A-02 Apple and Google are "coming soon".** Tap Get Started. Expected: Sign Up (02) says "Step 1 of 2" and "Create your account". The Apple and Google buttons are dimmed with a "Coming soon" tag, and tapping them does nothing. There is a Terms & Privacy Policy line.
- [ ] **A-03 Sign-up field checks.** Type an email without "@" and tap Continue. Expected: "Enter a valid email address.", the email field is highlighted, and the screen scrolls to it. Then use a valid email with a 7-character password and tap Continue. Expected: a message that the password needs at least 8 characters, the password field is highlighted, and the screen scrolls so **Continue** is visible. The Password field shows the hint "At least 8 characters." With the keyboard open on email or password, the screen scrolls so you can reach the next field and **Continue** without dismissing the keyboard.
- [ ] **A-04 Sign up sends a link.** Use a fresh email and an 8+ character password, then tap Continue. Expected: Check Your Email (02d) shows "We sent a link to [your email]. Open it on this phone to continue.", a **Back to Log In** button, and "Didn't get it? Resend email". An email arrives.
- [ ] **A-05 Resend.** Tap "Didn't get it? Resend email". Expected: "Sent. Check your inbox." and a second email arrives. (Sending is limited to one email per address every 30 seconds; a "Too many tries" message if you tap again right away is correct.)
- [ ] **A-06 Not signed in before confirming.** Before tapping the link, close and reopen the app. Expected: you are on Welcome, not inside the app.
- [ ] **A-07 Confirming signs you in.** Tap the link in the email on your phone. Expected: the app opens, you are signed in, and you land on Build Profile (03, "Step 2 of 2").



### Log in

- [ ] **A-08 Log In screen.** From Welcome, tap Log In. Expected: Log In (02b) with "Welcome back", dimmed Apple and Google buttons with "Coming soon", email and password fields, a "Forgot password?" link, a **Log In** button, and "New here? Get Started" (which opens Sign Up).
- [ ] **A-09 Wrong password doesn't say which part was wrong.** Enter a real account's email with the wrong password. Then try an email that has no account. Expected: both show the same message: "That email and password don't match. Try again."
- [ ] **A-10 Unconfirmed account.** Sign up with a new email but don't tap the link. Go to Log In and try that email and password. Expected: "Confirm your email first. Tap the link we sent you, or send a new one." and a **Resend confirmation email** link that sends a new email.
- [ ] **A-11 Where Log In takes you.** Log in with three accounts. Expected:
  - an account with an unfinished profile goes to Build Profile;
  - a finished profile that hasn't answered today goes to Today's Question;
  - an account that has answered **today (their phone's local calendar day)** goes to the Feed tab.



### Forgot password

- [ ] **A-12 Reset request.** On Log In, tap "Forgot password?". Expected: Forgot Password (02c), "Reset your password", an email field, **Send Reset Link**, and "Back to Log In".
- [ ] **A-13 Doesn't reveal who has an account.** Request a reset for an email with an account, then for one without. Expected: both go to Check Your Email with the same wording. Only the real account receives an email.
- [ ] **A-14 Set a new password.** Tap the reset link on your phone. Expected: Set New Password (02e), "Set a new password". Try 7 characters (refused), then 8+ and tap **Save Password**. Expected: you stay logged in and continue into the app. Log out (Profile tab), then log in with the new password. Expected: it works, and the old password no longer does.



### Build Profile

- [ ] **A-15 Photo required.** On Build Profile, before adding a photo, look at **Finish Setup**. Expected: it is greyed out. Add one photo. Expected: it becomes active.
- [ ] **A-16 Up to 6 photos.** Add photos until no empty slot is left. Expected: at most 6. Removing one frees a slot. The first photo is your main photo.
- [ ] **A-17 Required vs optional labels (03).** Under the title, expected: "Required: at least one photo, first name, birthday, and gender. Everything else is optional." **Photos**, **First Name**, **Birthday**, and **Gender** show an orange **Required** tag; other fields and sections show **Optional** (or "Optional · …" where there is extra helper text). With a photo added, leave first name, birthday or gender empty and tap Finish Setup. Expected: a banner names what's missing (for example "Add your first name, your gender to finish."), the screen scrolls to the **first** missing item, and you can't continue. Height is optional: **Feet** and **Inches** (stored as total inches for matching; for example 5 ft 9 in).
- [ ] **A-17b Location autocomplete (03).** On Build Profile, tap **Location** (optional). Type at least two letters (for example `bro`). Expected: a short list of US city and state matches appears (for example `Brooklyn, NY`). Tap one. Expected: the field fills with that label. Clear the field or type a different search; suggestions update as you type.
- [ ] **A-18 Under-18 birthday (03c).** Pick a birthday that makes you under 18 (you do not need to tap Finish Setup). Expected: as soon as the date is chosen, the Birthday field turns red and its hint reads "You must be 18 or older to join. Check your birthday." Everything else you entered is still there. Pick a valid birthday and finish.
- [ ] **A-19 Save error banner (03c).** Fill in a valid profile, turn on Airplane Mode, and tap Finish Setup. Expected: a red banner under the title reads "We couldn't save your profile. Check your connection and try again." Nothing you entered is lost. Turn Airplane Mode off and tap Finish Setup again. Expected: it saves.
- [ ] **A-20 Choices and "+ Add".** Check that Gender offers Woman / Man / Non-binary / More. Add a custom pronoun and a custom sexual orientation with **+ Add**. Expected: each appears as a selected chip. The limits hold: pronouns up to 3, orientation up to 5, lifestyle tags up to 10, languages up to 10, interests up to 5. Relationship Goals allows only one choice and shows a one-line description under each option.
- [ ] **A-21 About Me limit.** Type a long About Me. Expected: it stops at 500 characters.
- [ ] **A-22 Back button on Build Profile.** Tap the back arrow on Build Profile. Expected: you are logged out and returned to Welcome. Logging back in returns you to Build Profile.



### How It Works and the first recording

- [ ] **A-23 How It Works (03b).** After Finish Setup, expected: three steps (same question for everyone; answer on camera "up to 14 seconds"; your answer unlocks the feed) and a **Record My First Answer** button.
- [ ] **A-24 Recording length comes from the admin setting.** Ask the agent to change the recording length on staging (for example to 20 seconds), then reopen How It Works or Today's Question. Expected: both show the new number. Ask the agent to put it back to 14.
- [ ] **A-25 Today's Question (04).** Tap Record My First Answer. Expected: today's question text, the line "Everyone answers before anyone can see today's responses.", a camera preview, timer 0:00 and the hint "Tap to start recording". The first time, the phone asks for camera and microphone permission.
- [ ] **A-26 Permissions refused.** On a fresh install (or after turning camera access off in phone Settings), refuse permission and tap record. Expected: a message explaining the app needs the camera and microphone, with an **Open Settings** link.
- [ ] **A-27 Flip camera.** Tap the flip button before recording. Expected: it switches between front and back cameras. It can't be used while recording.
- [ ] **A-28 Countdown (04d).** Tap record. Expected: a big 3, 2, 1 over the preview and the hint "Get ready…", then recording starts.
- [ ] **A-29 Recording (04e).** While recording, expected: the record button becomes a stop square, a ring fills up, the timer counts up, and the hint says "Tap to stop". Tap stop after a few seconds. Expected: you go to Review & Submit.
- [ ] **A-30 Auto-stop at the cap.** Record without tapping stop. Expected: recording stops on its own at the recording length (14 seconds) and goes to Review.



### Review, captions and submit

- [ ] **A-31 Captions processing (05d).** Right after recording, expected: your video plays back. The caption box says "Making captions from your audio…" with a spinner, and the helper says "This usually takes a few seconds. You can submit once it's done." **Submit Answer** is greyed out.
- [ ] **A-32 Captions ready (05).** Wait a few seconds. Expected: the caption box shows what you said, with a pencil icon. The helper says it was auto-captioned from your audio and you can tap to edit. Submit Answer becomes active.
- [ ] **A-33 Edit Captions (05b).** Tap the caption. Expected: Edit Captions shows the **whole caption in one text box** (not separate timed lines). On **Android**, there is no video preview on this screen (only a line like "[length] recording — preview on Review"); on **iPhone**, the small video preview still plays. Change some words and tap **Save Captions**. Expected: Review shows your edited text. Open Edit Captions again and tap **Reset to auto**. Expected: the original automatic text returns.
- [ ] **A-34 No speech found (05e).** Record a few seconds of silence (cover the microphone, say nothing). Expected: the caption box says "No speech found, so this video has no captions.", there is no edit button, the helper says "You can still submit it, or re-record.", and Submit Answer works.
- [ ] **A-35 Re-record.** On Review, tap **Re-record**. Expected: you're back on Today's Question and can record again.
- [ ] **A-36 Close without submitting.** On Review, tap the X in the top left. Expected: you go to the Feed tab, which still shows Feed Locked (your answer wasn't submitted).
- [ ] **A-37 Answer Submitted (05c).** Submit a recording. Expected: "Answer Submitted!" with "Your response is live. You can now see what everyone else said today." and a **View Today's Feed** button. Tap it. Expected: the Feed tab opens today's video feed (Phase B), not a placeholder message.
- [ ] **A-38 Can't answer twice.** After submitting, close and reopen the app. Expected: it opens on the Feed, not on Today's Question.



### Skip, daily limit and no question

- [ ] **A-39 Skip (dialog on 04).** With a new account on Today's Question, tap "Skip today's question". Expected: "Skip today's question?", explaining you won't see today's responses until you answer and that matches and chats stay available, with **Return to Question** and **Skip Anyway**. Return to Question closes the dialog. Skip Anyway goes to the Feed tab.
- [ ] **A-40 Feed Locked (06m).** After skipping, expected: the Feed tab says today's feed is locked, shows today's question, and has an **Answer Today's Question** button. The Matches and Profile tabs still open.
- [ ] **A-41 Skipping isn't final.** On Feed Locked, tap Answer Today's Question, then record and submit. Expected: the feed unlocks and shows today's videos.
- [ ] **A-42 Daily limit (04f).** Ask the agent to set recordings per day to 2 on staging. With an account that hasn't submitted today, record twice and re-record each time without submitting, then tap record a third time. Expected: "Recording limit reached" says you've used all 2 of today's recordings, the limit resets with tomorrow's question, and matches and chats stay available, with a single **Got It** button. No countdown starts. The Feed tab stays locked. Ask the agent to put the setting back to 10.
- [ ] **A-43 No Question Today (04g).** Ask the agent to temporarily remove today's question on staging. Open the app with an account that hasn't answered. Expected: the Feed tab shows "No question yet today", says to check back soon and that you'll get a notification, and has a **Check again** button. You can't record. Matches and Profile still open. Ask the agent to restore the question, then tap Check again. Expected: it switches to Feed Locked with today's question.



### Tab bar and session

- [ ] **A-44 Tabs.** Expected: a bottom tab bar with Feed, Matches and Profile. Matches and Profile are simple placeholders in this phase. Profile has a **Log Out** link. On **Android**, the pill sits above the system navigation bar (including the always-visible 3-button bar) with clear spacing, not flush against it.
- [ ] **A-45 Stays logged in.** Close the app completely and reopen it. Expected: you're still logged in and land in the right place (see A-11). On Android in Expo Go, also reload the bundle (shake → Reload): if you already answered today, you should land on the Feed, not Today's Question.
- [ ] **A-46 Log out.** Tap Log Out on the Profile tab. Expected: you're back on Welcome. Reopening the app keeps you logged out.
- [ ] **A-47 Both platforms.** If you have access to both an iPhone and an Android phone, run A-25 to A-37 on each.

---



## Phase B — Feed and browse

Prerequisites: you have submitted today's answer (gate open). For a busy feed on staging, ask the agent to run `supabase/seed-staging-feed.mjs` on staging (demo accounts) in addition to your own recording.

- [ ] **B-01 Feed unlocks (06).** After **Answer Submitted**, open the Feed tab. Expected: full-screen videos (not Feed Locked), with today's question in the pill at the top, captions on screen, and name/age/distance at the bottom. On **Android**, the caption, streak badge, **⋯**, and heart sit **above** the tab bar with nothing hidden behind the pill.
- [ ] **B-02 Playback progress bar (06).** While a feed video plays, expected: the thin white bar at the very top fills left to right for **that clip only** (how far into the video you are). Swipe to another answer: the bar resets and fills again for the new clip. It does **not** show how many videos are left in the feed.
- [ ] **B-03 Muted autoplay and unmute.** Expected: the current video plays muted. Tap the speaker icon in the top row. Expected: you hear audio; tap again to mute.
- [ ] **B-04 Swipe anytime; views need watch time.** On a new video, expected: no **Skip** control and no countdown or lock before you can swipe. Swipe up **immediately** to the next answer. A view counts toward the poster's view count only after you have watched that clip for the minimum time (admin default 3 seconds); leaving sooner is allowed and simply does not count as a view.
- [ ] **B-05 Swipe between videos.** Swipe up. Expected: the next answer plays; the question pill updates if the day changes.
- [ ] **B-15 Unified page scroll (06).** On the feed, watch the **question pill and name** while you swipe up to the next video. Expected: the pill, captions, and bottom metadata **move off screen with the video** (one page scrolling away), not a fixed layer with only the video changing underneath. Repeat on **iPhone and Android**. (Spec: `docs/mobile-feed-scroll.md`.)
- [ ] **B-06 Following label.** If someone you follow posted today (agent can set this up on staging), their video shows an orange **Following** tag near the top.
- [ ] **B-07 Streak badge.** When the poster has a streak, expected: flame icon and text like **14-day streak** under their name.
- [ ] **B-08 Heart and more options (placeholder).** Tap the heart or **⋯**. Expected: alert title **Coming soon** with **Matching arrives in the next update.** or **More options arrives in the next update.**
- [ ] **B-09 Profile tap.** After **Phase C**, use **C-07** instead. Before Phase C: **Profile coming soon** sheet.
- [ ] **B-10 Browse Questions (06c).** From the feed, tap the **question pill** at the top (quote icon, date, question text, and down chevron) or **Browse Past Questions** on the end screen. Expected: list of past questions with dates and response counts; today shows **Live now · Today's feed**. Pick an older question. Expected: feed shows answers for that day only.
- [ ] **B-11 Search questions (06d).** On Browse Questions, type a word from an old question. Expected: the list filters; clearing search shows all again.
- [ ] **B-12 Caught up (06v).** Swipe up through every video for today (and earlier days in your look-back window if the feed rolls). Expected: only after the **last** video does the next swipe show **You're all caught up** (not after the first swipe). Body text **You've seen every answer from the last 7 days that matches your filters. Check back tomorrow, or adjust your Feed Settings to see more people.**, buttons **Browse Past Questions** and **Adjust Feed Settings** (settings alert: **Feed Settings arrives in the next update.** until Phase D).
- [ ] **B-13 Feed still locked without answer.** Log out, sign in with an account that has **not** answered today. Expected: Feed Locked (06m) unchanged from Phase A.
- [ ] **B-14 Both platforms.** Run B-01 through B-05 and **B-15** on iPhone and Android if you have both.

---



## Phase C — Profile and archive

Prerequisites: gate open for feed tests; staging seed helps for other people's profiles. Decisions: `docs/mobile-questions.md` (Oct 2026).

### Own profile (08, 08a)

- [ ] **C-01 Profile tab (08).** Open **Profile**. Expected: your photo, name, age, location, streak / matches / joined badges, follower count and profile view count (counts only), **Your Answers** preview row, full profile fields, and **Account** rows (Edit Profile, Feed Settings, etc.). **No** edit icon on the hero photo (editing is under **Account**). **Log Out** works.
- [ ] **C-02 Account placeholders.** Tap **Edit Profile**, **Feed Settings**, **Notifications**, **Privacy & Safety**, or **Blocked and Not Interested**. Expected: **Coming in the next update** (or equivalent) until Phase D — not a crash.
- [ ] **C-03 View counts on your answers.** On **08**, expected: eye icon + number on each answer thumbnail in **Your Answers** (only on your own profile).
- [ ] **C-04 See all (08a).** Tap **See all** in **Your Answers**. Expected: **08a Your Answers** with back arrow and title **Your Answers**, scrollable list of all your answers (newest first). Back returns to **08**.
- [ ] **C-05 Lazy load (08a).** On **08a**, with many answers on staging, scroll toward the bottom. Expected: older answers appear as you scroll (no need to load the entire list at once).
- [ ] **C-06 Disabled answer (08 / 08a).** Ask the agent to flag one of your answers disabled on staging. Expected: it still appears with a **hidden/disabled** state (not silently removed).

### Someone else's profile (06j, 06n, 07h)

- [ ] **C-07 Open from feed (06j).** On the feed, tap the poster's **name**. Expected: their profile (**06j**), not the Phase B placeholder sheet. Section headers (**About**, **Photos**, **Lifestyle**, **Jordan's Answers**, etc.) use **Anton** at 16pt (same as Pencil **06j**), not bold Funnel Sans.
- [ ] **C-08 Photos grid.** Expected: up to **6** photos in **2 rows × 3**; **no** “N photos ›” row. No verified badge.
- [ ] **C-09 Photo viewer (06ja).** Tap a photo. Expected: **06ja** with whole image visible (letterboxed), centered; **1 of N** below the image; **back** upper left returns to profile. Pinch to zoom; one-finger pan when zoomed. Swipe up/right → next photo; down/left → previous (horizontal slide).
- [ ] **C-10 Archive scroll (07h / 06j).** On a profile with many answers (e.g. **07h** or seeded user), scroll the profile. Expected: you can reach **all** of their answers; more load as you scroll (**lazy loading**).
- [ ] **C-11 Heart and more (placeholder).** On **06j**, tap heart or **⋯**. Expected: **Coming soon** alerts until Phase D.
- [ ] **C-12 Answer row → 06k.** Tap an answer in their archive. Expected: **06k Answer Detail** full screen.

### Answer detail (06k)

- [ ] **C-13 Top chrome (06k).** On **06k**, check the top row under the progress bar. Expected: **question pill** like **06** (quote icon top-aligned on the left, **Oct 5 ·** date before question text, wrapping label; **no** down chevron — pill is not tappable here); **mute** control in a circular button to the right of the pill (no feed-settings icon on this screen). Video plays muted; tap mute to hear audio and tap again to mute.
- [ ] **C-14 Unified scroll (06k).** On **06k**, swipe vertically to the next/older answer. Expected: video and chrome scroll as **one page** (same pattern as feed, `docs/mobile-feed-scroll.md`).
- [ ] **C-14a Bottom chrome on Android (06k).** On **Android**, open **06k** from a profile. Expected: caption, name, and action buttons sit on the **bottom** of the screen (above the system nav bar only), not floating ~100px higher; bottom gradient reaches the screen edge.
- [ ] **C-15 Back to profile.** Tap back on **06k**. Expected: return to the profile you came from.

### Feed locked (3A)

- [ ] **C-16 Profile while feed locked.** With an account that has **not** answered today, open another person's profile (e.g. from Matches when Phase D exists, or ask agent for entry path). Expected: profile and answer **list** visible; tapping playback shows a clear message that you must answer today to watch (gate), not a silent failure.

### Both platforms

- [ ] **C-17 Both platforms.** Run C-01, C-04, C-07, C-09, C-13, and C-14 on iPhone and Android if you have both.

---

## Phase D — Social screens

Added when Phase D is built.

## Phase E — Polish

Added when Phase E is built.
