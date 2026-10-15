# UAT Flows — Cats or Dogs? Mobile App

User acceptance tests (UAT) are hands-on checks you run on a real phone to confirm the app works the way the requirements and designs say it should. Automated tests already cover the server rules; these cover what a person actually sees and does.

Each mobile phase (A through E) adds its own section below when it is built. Screen numbers (02b, 04f, and so on) match the frames in `docs/pencil-new.pen` and the requirements doc, so you can compare the phone against the design.

Tick each box when the result matches. If something doesn't match, note the test ID (for example A-07) and what you saw, and the agent will fix it.

Screen-by-screen checks live in this file. The ordered multi-account script — who signs up, who posts, and what the other person should see — is in [master-test.md](master-test.md). Run that when you want the whole product checked on staging, including the admin website, the feed order, and notifications.

## Before you start (every phase)

1. **Expo Go on your phone.** Install it from the App Store or Google Play. Mike tests this way (not a custom dev build). It runs the app straight from your Mac without publishing it.
2. **Start the app.** Ask the agent to start it, or run `cd mobile && npm run phone` yourself (not `npm start`, or email links can't reopen the app). Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android). The address changes each time the server restarts, so rescan, and ask for a fresh email link if one was sent before the restart. Full steps and troubleshooting are in the README, under "Running the app on your phone (Expo Go)".
3. **Staging, not production.** The app on your Mac points at the staging backend ("Cats or Dogs - Staging"). Nothing you do here touches real users.
4. **Test accounts.** Use a fresh email for each "new user" test. With Gmail, `you+uat1@gmail.com`, `you+uat2@gmail.com` and so on all arrive in your normal inbox but count as different accounts.
5. **Open email links on the phone.** Confirmation and password-reset links must be tapped on the same phone that is running Expo Go, so they open the app.
6. **Settings you can't change from the phone** (recording length, recordings per day, whether today has a question): ask the agent to change them on staging for the test, and to put them back afterwards.
7. **Expo Go expectations.** A yellow **"WebCrypto API is not supported"** message right after sign-up is normal in Expo Go; continue if the confirmation email arrives and the link opens the app. **Remote push does not work in Expo Go on Android** (SDK 53+); use **email** toggles in **08c** to test notifications, as in [master-test.md](master-test.md).
8. **Staging video (Mux test mode off).** Staging uses the **Mux Staging** environment with **`MUX_TEST_MODE=false`**: clips play **without** a test watermark, up to the admin **recording length** (default 14 seconds), and they **stay** until deleted (no automatic 24-hour removal). That matches production-style playback on the staging backend. The old free-tier **10-asset** cap no longer applies if your Mux plan was upgraded. Re-recording still counts toward **recordings per day** (default 10). See README and [master-test.md](master-test.md) item 8.

---



## Phase A — Onboarding and core loop

Covers: Welcome (01), Sign Up (02), Log In (02b), Forgot Password (02c), Check Your Email (02d), Set New Password (02e), Build Profile (03), its Gender "More" list (03d) and Interests picker (03e), and its errors (03c), How It Works (03b), Today's Question (04, 04d, 04e), Skip (04 dialog), Daily Limit Reached (04f), No Question Today (04g), Review & Submit (05, 05d, 05e), Edit Captions (05b), Answer Submitted (05c), Feed Locked (06m), and the tab bar. Matches and Profile are placeholders until Phases C and D. The scrollable video feed is Phase B (see below).

### Sign up and email confirmation

- [ ] **A-01 Welcome screen.** Open the app for the first time. Expected: the Welcome screen (01) with the app name, "Pick your pack", a **Get Started** button and a **Log In** link.
- [ ] **A-02 Apple and Google are "coming soon".** Tap Get Started. Expected: Sign Up (02) says "Step 1 of 2" and "Create your account". The Apple and Google buttons are dimmed with a "Coming soon" tag, and tapping them does nothing. There is a Terms & Privacy Policy line.
- [ ] **A-03 Sign-up field checks.** Type an email without "@" and tap Continue. Expected: "Enter a valid email address.", the email field is highlighted, and the screen scrolls to it. Then use a valid email with a 7-character password and tap Continue. Expected: a message that the password needs at least 8 characters, the password field is highlighted, and the screen scrolls so the **Password** label sits near the top of the screen. The Password field shows the hint "At least 8 characters." Tap into **Email** or **Password**: expected placeholder text inside the field **disappears while focused** (returns if you leave the field empty). With the keyboard open, the screen scrolls so the field label stays near the top and you can reach **Continue** without dismissing the keyboard. (Same focus behavior on other text fields app-wide except chat.)
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

- [ ] **A-15 Profile photo required.** On Build Profile (03), before adding a **Profile photo**, look at **Finish Setup**. Expected: it is greyed out. Add a circular **Profile photo** (position 1). Expected: **Finish Setup** becomes active. Helper under the section: "Used as your avatar in matches, chats, and lists."
- [ ] **A-16 More photos (optional).** Scroll to **More photos** above **Finish Setup**. Expected: helper mentions **Up to 6 more** and that they are **not** your profile photo; a 2×3 grid for gallery slots (not counting the circular profile photo). Add a photo from the library. Expected: when the picker closes, you stay at **More photos** (the screen does not jump up to **About Me** or another field). The new thumbnail shows the image (not an empty tile). Add photos until all six optional slots are filled. Expected: **1 profile photo + up to 6 gallery photos** (avatar does not appear in the grid on **08**). Removing the profile photo greys out **Finish Setup** again. On **Android**, repeat in **Edit Profile (08d)** if you already finished sign-up.
- [ ] **A-17 Required vs optional labels (03).** Under the title, expected: "Required: profile photo, first name, birthday, and gender. Everything else is optional." **Profile photo**, **First Name**, **Birthday**, and **Gender** show an orange **Required** tag; other fields and sections show **Optional** (or "Optional · …" where there is extra helper text). With a profile photo added, leave first name, birthday or gender empty and tap Finish Setup. Expected: a banner names what's missing (for example "Add your first name, your gender to finish."), the screen scrolls to the **first** missing item, and you can't continue. Height is optional: **Feet** and **Inches** (stored as total inches for matching; for example 5 ft 9 in).
- [ ] **A-17b Location autocomplete (03).** On Build Profile, tap **Location** (optional). Type at least two letters (for example `bro`). Expected: a short list of US city and state matches appears (for example `Brooklyn, NY`). Tap one. Expected: the field fills with that label. Clear the field or type a different search; suggestions update as you type.
- [ ] **A-18 Under-18 birthday (03c).** Pick a birthday that makes you under 18 (you do not need to tap Finish Setup). Expected: as soon as the date is chosen, the Birthday field turns red and its hint reads "You must be 18 or older to join. Check your birthday." Everything else you entered is still there. Pick a valid birthday and finish.
- [ ] **A-19 Save error banner (03c).** Fill in a valid profile, turn on Airplane Mode, and tap Finish Setup. Expected: a red banner under the title reads "We couldn't save your profile. Check your connection and try again." Nothing you entered is lost. Turn Airplane Mode off and tap Finish Setup again. Expected: it saves. If you are online and still see the connection banner, read the full message (after a reload): the server may be explaining a rule (for example a missing profile photo).
- [ ] **A-20 Choices and "+ Add".** Check that Gender offers **Woman**, **Man**, and a **More >** chip (the full list is tested in **A-20b**) and Sexual Orientation offers Straight / Gay / Lesbian / Bisexual / Asexual / Demisexual / Pansexual / Queer / Questioning (in that order, wrapping over three rows) with **no** **+ Add** on orientation, and a "Show orientation on my profile" card (switch on by default; helper "When off, only you can see it. It still helps with matching.") below the chips. **Languages** does not appear on Build Profile or Edit Profile. The limits hold: orientation allows only **one** choice (the header reads "Optional · Choose one"; tapping another chip moves the selection; tapping the selected chip clears it), interested in up to 3 (Men / Women / Non-Binary), Interests up to 5 (tested in **A-20f**). Relationship Goals allows only one choice and shows a one-line description under each option.
- [ ] **A-20b Gender: More list (03 / 03d).** On Build Profile, find **Gender**. Expected: chips **Woman**, **Man**, **More >**, and below them a card "Show gender on my profile" with the helper "When off, only you can see it. It still helps with matching." and a switch that is **on** by default. Tap **More**. Expected: a **Gender** screen (03d) with the subtitle "Choose the option that best describes you." and a single-choice list in this order: Agender, Androgyne, Androgynous, Bigender, Female to Male, FTM, Gender Fluid, Gender Nonconforming, Gender Questioning, Gender Variant, Male to Female, MTF, Neither, Neutrois, Non-binary, Other, Pangender, Trans, Trans Man, Trans Person, Trans Woman, Transfeminine, Transgender, Transgender Female, Transgender Male, Transgender Man, Transgender Person, Transgender Woman, Transmasculine, Two-Spirit. Pick **Non-binary**. Expected: you return to Build Profile; the **More** chip now reads **Non-binary** (orange, selected) and **Woman** and **Man** are not selected. Pick **Trans Woman** or **Transgender Person** the same way to check that a long choice is cut off with an ellipsis rather than stretching the row. Tap the chip again. Expected: 03d reopens with your choice marked. Tap **Woman**. Expected: the More chip goes back to "More >". On **Android**, the system back button on 03d returns to Build Profile without changing your choice.
- [ ] **A-20d Show orientation on my profile (03 / 08d).** Pick an orientation chip (the selected chip turns orange; only one can be selected), turn **Show orientation on my profile** off, and finish setup (or **Save Changes** on Edit Profile). Expected: the other test account does not see your orientation on your profile; you still do. Turn it back on and save. Expected: visible again. Hidden orientation still counts for the Sexual orientation filter in Feed Settings.
- [ ] **A-20c Show gender on my profile (03 / 08d).** With a gender chosen, turn the switch **off** and finish setup (or tap **Save Changes** on Edit Profile). Open your own profile (08) and, from a second test account, view your profile (06j). Expected: the other account does **not** see your gender; you still do. Turn the switch back **on** and save. Expected: the other account sees it again. The setting also applies to gender chosen from **More**. Gender is still required on Build Profile: with no gender chosen, Finish Setup shows the missing-field banner (A-17) whether or not the switch is on. Hidden gender still counts for Show me (try Show me: Women / Men from the other account in Feed Settings).
- [ ] **A-20e Interests: empty state and picker (03 / 03e).** On Build Profile, find **Interests** (where Lifestyle used to be). Expected: the header **Interests** with the grey **Optional** tag, and one **Select Interests** pill with a chevron; no other pills. Tap it. Expected: screen **03e** lists every interest as pills in alphabetical order (starting **00s Kid**, ending **Youth Empowerment**), a counter "0 of 5 selected" next to the back arrow, the title **Interests**, the subtitle "Pick up to 5 things you love.", and a **Done** button pinned to the bottom of the screen (it stays visible while you scroll the list, with the same space above it as below it); the row with the back arrow and the "N of 5 selected" counter also stays fixed at the top while you scroll that is greyed out and does nothing when tapped. Check the order around acronyms: **Basketball**, **BBQ**, **Beach Bars**; **Diving**, **DIY**, **Documentaries**; **E-Sports**, **EDM**, **Electronic Music**.
- [ ] **A-20f Interests: pick up to 5 (03e).** On 03e, tap **Coffee**, **Hiking**, **Travel**. Expected: they turn orange, the counter reads "3 of 5 selected", and **Done** becomes active. Pick two more (5 of 5). Expected: tapping any further unselected pill does nothing (the counter stays at "5 of 5 selected"). Tap a selected pill. Expected: it is deselected and the others become available again. Tap **Done**. Expected: you return to Build Profile with **Coffee**, **Hiking**, **Travel** (and any others) as orange pills and an orange **Edit** link in the **Interests** header; the **Select Interests >** pill is gone.
- [ ] **A-20g Interests: Edit and discard (03e).** Tap **Edit** in the Interests header. Expected: 03e opens with your picks already selected and **Done** greyed out. Tap the back arrow. Expected: it returns without a prompt (nothing changed). Open **Edit** again, deselect one pill, tap the back arrow. Expected: the **Discard changes?** dialog (body "You have unsaved edits to your profile. If you leave now, your changes won't be saved."). Tap **Keep Editing**; expected: you stay on 03e. Tap back again, then **Leave Without Saving**; expected: Build Profile still shows your earlier picks. Reopen **Edit**, change a pick, tap **Done**; expected: Build Profile shows the new picks. Deselect everything and tap **Done**; expected: the section goes back to the single **Select Interests >** pill.
- [ ] **A-21 About Me limit.** Type a long About Me. Expected: it stops at 500 characters.
- [ ] **A-21b No placeholder text on Build Profile and Edit Profile (03 / 08d).** With a brand-new account, open Build Profile (03). Expected: **First Name**, **Birthday**, **Feet**, **Inches**, **Location**, **Occupation**, **School**, and **About Me** are all empty, with only their labels shown. No example text such as "Alex", "January 1, 2000", "5", "9", "Brooklyn, NY", or "Tell people about yourself" appears inside any field. The 18-or-older line under Birthday is still there. Tap **+ Add** under a choice list: the box that opens is empty, with no "Add your own" hint. Open **Edit Profile** and clear a field (for example **School**). Expected: the field is empty with no placeholder text.
- [ ] **A-22 Back button on Build Profile.** With no edits since the screen loaded, tap the back arrow on Build Profile (03). Expected: you are logged out and returned to Welcome. Logging back in returns you to Build Profile.
- [ ] **A-22b Discard unsaved Build Profile edits (03 / 08d dialog).** Change a field (for example **About Me**), then tap the back arrow. Expected: dimmed screen and dialog **Discard changes?** with **Leave Without Saving** and **Keep Editing**. **Keep Editing** closes the dialog and leaves your text. Tap back again and choose **Leave Without Saving**. Expected: logged out to Welcome; logging back in shows Build Profile without that unsaved text. On Android, repeat with the system back button instead of the arrow. **Finish Setup** with a valid profile must **not** show this dialog; you go straight to **How It Works (03b)**.



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
- [ ] **A-40 Feed Locked (06m).** After skipping, expected: the Feed tab says today's feed is locked, shows today's question, and has an **Answer Today's Question** button. Lock icon, copy, question card, and button are **centered vertically** between the top of the screen and the bottom tab bar (not sitting low behind the tab bar). The Matches and Profile tabs still open.
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
- [ ] **B-08 Heart and more options.** After Phase D, use **D-01** and **D-08** on the feed instead of this item.
- [ ] **B-09 Profile tap.** After **Phase C**, use **C-07** instead. Before Phase C: **Profile coming soon** sheet.
- [ ] **B-10 Browse Questions (06c).** From the feed, tap the **question pill** at the top (quote icon, date, question text, and down chevron) or **Browse Past Questions** on the end screen. Expected: list of past questions with dates and response counts; today shows **Live now · Today's feed**. Pick an older question. Expected: feed shows answers for that day only.
- [ ] **B-11 Search questions (06d).** On Browse Questions, type a word from an old question. Expected: the list filters; clearing search shows all again.
- [ ] **B-12 Caught up (06v).** Swipe up through every video for today (and earlier days in your look-back window if the feed rolls). Expected: only after the **last** video does the next swipe show **You're all caught up** (not after the first swipe). Body text **You've seen every answer from the last 7 days that matches your filters. Check back tomorrow, or adjust your Feed Settings to see more people.**, buttons **Browse Past Questions** and **Adjust Feed Settings** (opens **06i** Feed Settings after Phase D — see **D-36**).
- [ ] **B-13 Feed still locked without answer.** Log out, sign in with an account that has **not** answered today. Expected: Feed Locked (06m) unchanged from Phase A.
- [ ] **B-14 Both platforms.** Run B-01 through B-05 and **B-15** on iPhone and Android if you have both.

---



## Phase C — Profile and archive

Prerequisites: gate open for feed tests; staging seed helps for other people's profiles. Decisions: `docs/mobile-questions.md` (Oct 2026).

### Own profile (08, 08a)

- [ ] **C-01 Profile tab (08).** Open **Profile**. Expected: your photo, name, age, location, streak / matches / joined badges, follower count and profile view count (counts only), **Your Answers** preview row, full profile fields, and **Account** rows (Edit Profile, Feed Settings, etc.). **No** edit icon on the hero photo and **no** orange **Edit** link on **Your Photos**; tapping **Add photo** in the grid opens the photo library (same flow as **More photos** on **08d**), not **Edit Profile**. Your sign-in **email** appears in the Account section directly above **Log Out** (helps tell test accounts apart). **Log Out** works.
- [ ] **C-02 Account rows.** After Phase D, use **D-30** (each Account row opens a real screen). Before Phase D: placeholders only.
- [ ] **C-03 View counts on your answers.** On **08**, expected: eye icon + number on each answer thumbnail in **Your Answers** (only on your own profile).
- [ ] **C-04 See all (08a).** Tap **See all** in **Your Answers**. Expected: **08a Your Answers** with back arrow and title **Your Answers**, scrollable list of all your answers (newest first). Back returns to **08**.
- [ ] **C-05 Lazy load (08a).** On **08a**, with many answers on staging, scroll toward the bottom. Expected: older answers appear as you scroll (no need to load the entire list at once).
- [ ] **C-06 Disabled answer (08 / 08a).** Ask the agent to flag one of your answers disabled on staging. Expected: it still appears with a **hidden/disabled** state (not silently removed).

### Someone else's profile (06j, 06n, 07h)

- [ ] **C-07 Open from feed (06j).** On the feed, tap the poster's **name**. Expected: their profile (**06j**), not the Phase B placeholder sheet. Section headers (**About**, **Photos**, **Interests**, **Jordan's Answers**, etc.) use **Anton** at 16pt (same as Pencil **06j**), not bold Funnel Sans.
- [ ] **C-08 Photos grid.** Expected: the **hero** shows their **profile photo** (avatar); **Photos** below shows up to **6 gallery photos** only (avatar **not** duplicated in the grid) in **2 rows × 3**; **no** “N photos ›” row. No verified badge. On your own **08**, **Your Photos** follows the same rule (no avatar in the grid).
- [ ] **C-09 Photo viewer (06ja).** Tap a **gallery** thumbnail (not the hero). Expected: **06ja** with whole image visible (letterboxed), centered; **1 of N** counts **gallery** photos only; **back** upper left returns to profile. Pinch to zoom; one-finger pan when zoomed. Swipe up/right → next photo; down/left → previous (horizontal slide).
- [ ] **C-10 Archive scroll (07h / 06j).** On a profile with many answers (e.g. **07h** or seeded user), scroll the profile. Expected: you can reach **all** of their answers; more load as you scroll (**lazy loading**).
- [ ] **C-11 Heart and more on profile.** After Phase D, use **D-10** and **D-11** on **06j**. Before Phase D: placeholder alerts only.
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

**Status:** Built on branch `phase-d-social` (Oct 2026). Reload Expo after pulling; run `cd mobile && npm install` once for `expo-notifications`.

Prerequisites: two test accounts for match/chat; staging seed optional. Decisions: `docs/mobile-questions.md` (Phase D, Oct 12, 2026). **UAT order:** run **D-01–D-18** first (menus + heart + nudge), then **D-19–D-28** (Matches + chat), then **D-29–D-38** (Feed Settings + Account). **B-08**, **C-02**, and **C-11** defer to the D tests below when Phase D is on your build.

### Menus, heart, follow, nudge (test first)

- [ ] **D-01 More options feed (06e).** On feed **06**, tap **⋯**. Expected: **Follow**, **Not Interested**, **Report**, **Block**, **Cancel** in that order.
- [ ] **D-02 Follow (06l).** **Follow** → confirm. Expected: the in-app confirmation card (dimmed feed behind it, their **profile photo** with a small **follow** badge on the avatar—not a large warning icon—title, body, orange primary button, **Cancel** text below)—not the iOS/Android system alert. Copy matches **06l**; **Following** on their feed videos when they post (see B-06).
- [ ] **D-03 Unfollow (06s).** **⋯** → **Unfollow** → confirm. Expected: silent unfollow.
- [ ] **D-04 Not Interested (06f / 06w).** **Not Interested** → confirm. Expected: **Yes, Hide** or **Yes, Hide and Unfollow** if following; they leave your feed.
- [ ] **D-05 Report video (feed / 06k).** On feed **06** or **06k**, **⋯** → **Report**. Expected: flag confirmation about **this response** (community guidelines); not profile-report wording.
- [ ] **D-06 Report profile (06p).** On **06j**, **⋯** → **Report** (profile report confirmation **06p**). Expected: dialog states they won't be notified (not the per-video flag copy).
- [ ] **D-07 Block (06h).** **Block** → confirm. Expected: block copy; users hidden from each other.
- [ ] **D-08 Heart send feed (06b).** Tap heart on a feed video. Expected: **Match with [name]?** → **Yes, Match**; heart selected on their videos/profile.
- [ ] **D-09 Heart cancel (07f).** With an outgoing request, tap selected heart. Expected: cancel confirmation; heart clears.
- [ ] **D-10 Heart profile (07i / 06z).** On **06j**, heart → **07i** → send. Expected: **06z** (or equivalent success on profile) and selected heart everywhere.
- [ ] **D-11 More on 06k.** On **06k**, heart and **⋯** behave like feed/profile (Report on **06k** flags that answer's video).
- [ ] **D-12 Match while feed locked.** Without today's answer, send a match from someone's profile. Expected: match works; feed playback still gated (C-16).
- [ ] **D-13 Nudge (06n / 06o).** Follow someone who has not answered today; on **06n**, nudge → **06o**. Expected: server once-per-day limit.
- [ ] **D-14 Blocked list (08e).** After block, **Profile** → **Blocked and Not Interested** → **Blocked**. Expected: person listed; **Unblock**.
- [ ] **D-15 Unblock (08g).** Unblock with confirmation. Expected: silent; no restored match/chat/follow.
- [ ] **D-16 Not Interested undo (08f).** **Not Interested** tab → **Undo**. Expected: they can appear in feed again; follow not restored.
- [ ] **D-17 Allow followers (08b).** Turn off **Allow followers**. Expected: others cannot newly follow; nudge rules per MVP.
- [ ] **D-18 Menu parity.** Same **⋯** options on **06**, **06j**, and **06k**; only Follow/Unfollow label changes when following.

### Matches and chat (test second)

- [ ] **D-19 Matches segments (07).** **Matches** tab. Expected: **Chats**, **Incoming**, **Outgoing** segments at top in that order (one screen; not a separate app tab for Chats). The **selected** segment pill has an **orange** background and white label (per **07b**). From **Feed** (e.g. **06u**), when you have an incoming match request or unread peer chat messages, the bottom tab **Matches** heart is **filled orange** (inactive tab); it returns to gray outline when there is nothing pending.
- [ ] **D-20 Incoming row.** As recipient, Expected: name, age, avatar, time; **Liked your answer to …** or **Wants to match with you**.
- [ ] **D-21 Decline (07g).** **Decline** on Incoming row. Expected: **07g** confirmation; request removed; sender not notified.
- [ ] **D-22 Accept (07h).** **View Profile** → **Accept**. Expected: mutual match; chat opens.
- [ ] **D-23 Outgoing (07e).** **Outgoing** segment. Expected: **Waiting for a response · Sent [when]**; **Cancel Request** and **View Profile**.
- [ ] **D-24 Chats list (07b).** **Chats** segment. Expected: name, avatar, last message preview, relative time; an **orange dot** under the time only when the **other person** sent unread messages (not when you sent the last message). The **Chats** pill badge is the **total of those peer unread messages** across chats. Opening the chat clears that thread's unread state.
- [ ] **D-25 Chat send (07c).** Open a chat. Expected: header shows their **photo**, **First name, age**, and **city** (same format as profile location, e.g. `Brooklyn, NY`)—not "Active now". Tap the photo or name row to open their profile. The thread opens **scrolled to the latest message** at the bottom. Send a message (emoji ok, up to 1,000 characters). Expected: appears in thread; other user sees it in Realtime when chat is open. With the keyboard open, the **Message** field and **Send** row stay pinned above the keyboard (Android and iOS).
- [ ] **D-26 Mute chat (07d).** Chat header bell. Expected: **07d** confirmation; mute honored by server.
- [ ] **D-27 Report message (07m).** Flag icon in chat header. Expected: **07m** confirmation.
- [ ] **D-28 Unmatch (07n).** Unmatch from chat. Expected: **07n** confirmation; chat ends; other person not notified.

### Feed Settings and Account (test third)

- [ ] **D-29 Feed Settings (06i).** Feed settings control or **08** → **Feed Settings**. Expected: **Filters** and **Ranking**; save changes what you see in the feed. The filters no longer include **Smoking**, **Drinking**, **Interests**, **Maximum distance**, **Occupation** or **Relationship goals**; the order is Show me, Sexual orientation, Age range, Height, and Ranking has three signals (Shared Interests, Relationship Goals, Distance) — no **Lifestyle Compatibility**, **Response Depth**, or **Recency**. Shared Interests reads "How much overlap in your chosen Interests matters. Pick Specific to choose exactly which interests count most." There is no **Interests** filter and no long list of Interest pills on this screen.
- [ ] **D-29i Age range and Height sliders (06i).** Open **Feed Settings**. Expected: **Age range** is a slider with two draggable handles, **18** at the left end and **70+** at the right end, and the orange value above it reads **18 – 70+**. **Height** is the same, **2'0"** at the left and **7'0"+** at the right, reading **2'0" – 7'0"+**. Drag a handle. Expected: the value updates live, and the handles can touch but not cross. Set Age range to **25 – 40**, **Save**, leave and come back. Expected: **25 – 40** is kept. Drag both handles back to the ends and Save. Expected: it is the same as Any (nobody is hidden). Dragging the right handle to **70+** with the left at **30** includes people over 70.
- [ ] **D-29j No Relationship goals filter (06i).** Expected: no **Relationship goals** pill list under Filters; the **Relationship Goals** Low / Medium / High ranking card is still there.
- [ ] **D-29a Shared Interests: Specific (06i / 06ia).** Open **Feed Settings**. Expected: Shared Interests shows four segments: **Low**, **Medium**, **High**, **Specific**; the other two ranking cards still show three. Tap **Specific**. Expected: a **Choose specific interests** row appears with **0 selected** and a chevron.
- [ ] **D-29b Specific Interests screen (06ia).** Tap **Choose specific interests**. Expected: a dark screen titled **Specific Interests** with a back arrow, an orange **0 selected** counter at the top (stays visible while scrolling), all 278 interests as pills in alphabetical order (unselected: black with white outline and white text; selected: orange), and a **Done** button pinned at the bottom, disabled until you change something. Tap 6 or more pills. Expected: no limit; the counter counts up (**6 selected**). Tap a selected pill. Expected: it unselects and the count drops.
- [ ] **D-29c Specific is saved (06i).** Tap **Done**. Expected: Feed Settings shows **Specific** selected and the row reads **6 selected**. Tap **Save**, leave the screen and come back. Expected: **Specific** and **6 selected** are still there. Switch to **High**. Expected: the row disappears; switch back to **Specific**. Expected: **6 selected** again.
- [ ] **D-29d Specific changes the order (06i / 06).** With Specific selected and a few interests picked that other people have (ask me to confirm which feed profiles have them), Save and open the feed. Expected: people who share those interests appear higher than before. 
- [ ] **D-29e Reset clears Specific (06i).** With Specific and picks saved, tap **Reset**. Expected: Shared Interests returns to **Medium** and the Specific picks are cleared (choose **Specific** again: **0 selected**).
- [ ] **D-29f Specific with no picks goes back (06i).** Set Shared Interests to **High**. Tap **Specific**, open **Choose specific interests**, pick nothing and tap back (no dialog, since nothing changed). Expected: Shared Interests is back on **High**. Tap **Specific** again and tap **Save** without picking. Expected: after saving it shows **High**, not Specific.
- [ ] **D-29g Discard changes on 06ia.** Open **Choose specific interests**, tap a pill, then tap the back arrow (or the Android back button). Expected: **Discard changes?** dialog with **Leave Without Saving** and **Keep Editing**. Keep Editing stays; Leave returns to Feed Settings with the picks unchanged. With no changes, back leaves without a dialog.
- [ ] **D-29h Done is fully visible on Android (06ia).** On an Android phone with the 3-button navigation bar, open **Choose specific interests** and scroll. Expected: the **Done** button is fully visible above the navigation bar, with a gap of about 24 points above and below it (the iPhone gap includes the home indicator). Same on a phone with gesture navigation.
- [ ] **D-30 Account rows (08).** Each Account row opens a real screen (not **Coming in the next update**).
- [ ] **D-31 Edit Profile (08d).** Edit a field → **Save Changes**. Expected: updates on **08**.
- [ ] **D-31c Edit Profile gender (08d / 03d).** Open **Edit Profile**. Expected: the Gender section matches Build Profile (**Woman**, **Man**, **More >**, and the **Show gender on my profile** switch), pre-filled with your saved choice. If your saved gender came from the More list, the More chip shows it as selected (cut off with an ellipsis if long). Tap it, pick a different option on **Gender (03d)**, then **Save Changes**. Expected: **08** shows the new gender, unless the switch is off.
- [ ] **D-31d Edit Profile interests (08d / 03e).** Open **Edit Profile**. Expected: the **Interests** section behaves as in **A-20e–A-20g** (Edit link and selected pills when you already have picks). Change a pick, tap **Done**, then **Save Changes**. Expected: your profile (**08**) shows the new picks under **Interests**. Without tapping Save Changes, tap the back arrow after changing picks: the **Discard changes?** dialog appears.
- [ ] **D-31b Discard unsaved Edit Profile edits (08d).** Open **Edit Profile**, change **About Me**, tap the back arrow without saving. Expected: same **Discard changes?** dialog as **A-22b**. **Keep Editing** returns to the form with your text. **Leave Without Saving** returns to **08** without saving. On Android, the system back button shows the same dialog when there are unsaved edits.
- [ ] **D-32 Notifications (08c).** Open **Notifications** on a **new** account. Expected: **Push** and **Email** are on for Daily question, Matches, Messages, and Nudges. Turn one channel off for one type, leave, and return. Expected: your choice persists (server prefs).
- [ ] **D-33 Push on device.** Requires a **development build** (not Expo Go; Android remote push was removed from Expo Go in SDK 53+). Allow notifications when prompted. Expected: match/message pushes can arrive when toggles are on (agent can verify token on staging). In Expo Go, **08c** still opens and toggles save; a short note explains push needs a dev build.
- [ ] **D-34 Help & Support.** When admin Help URL is set, tap **Help & Support**. Expected: opens in browser. When URL is empty, Expected: clear disabled or empty state per build.
- [ ] **D-35 Delete account (08h).** **08b** → delete → **08h** confirm. Expected: account removed; gone from others' lists/feeds.
- [ ] **D-36 Caught up → settings.** From **06v**, **Adjust Feed Settings**. Expected: opens **06i** (not placeholder alert).
- [ ] **D-37 Ranking reset (06i).** **Reset** ranking. Expected: recommended defaults restored.
- [ ] **D-38 Both platforms.** Run D-01, D-19, D-25, and D-29 on iPhone and Android if you have both.

## Phase E — Polish

Added when Phase E is built.
