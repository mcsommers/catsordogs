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

Covers: Welcome (01), Sign Up (02), Log In (02b), Forgot Password (02c), Check Your Email (02d), Set New Password (02e), Build Profile (03) and its errors (03c), How It Works (03b), Today's Question (04, 04d, 04e), Skip (04 dialog), Daily Limit Reached (04f), No Question Today (04g), Review & Submit (05, 05d, 05e), Edit Captions (05b), Answer Submitted (05c), Feed Locked (06m), and the tab bar. Matches and Profile are placeholders until Phases C and D, and the video feed itself arrives in Phase B.

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
  - an account that has answered today goes to the Feed tab.

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
- [ ] **A-37 Answer Submitted (05c).** Submit a recording. Expected: "Answer Submitted!" with "Your response is live. You can now see what everyone else said today." and a **View Today's Feed** button. Tap it. Expected: the Feed tab shows "You're in for today". The real video feed arrives in Phase B.
- [ ] **A-38 Can't answer twice.** After submitting, close and reopen the app. Expected: it opens on the Feed, not on Today's Question.

### Skip, daily limit and no question

- [ ] **A-39 Skip (dialog on 04).** With a new account on Today's Question, tap "Skip today's question". Expected: "Skip today's question?", explaining you won't see today's responses until you answer and that matches and chats stay available, with **Return to Question** and **Skip Anyway**. Return to Question closes the dialog. Skip Anyway goes to the Feed tab.
- [ ] **A-40 Feed Locked (06m).** After skipping, expected: the Feed tab says today's feed is locked, shows today's question, and has an **Answer Today's Question** button. The Matches and Profile tabs still open.
- [ ] **A-41 Skipping isn't final.** On Feed Locked, tap Answer Today's Question, then record and submit. Expected: the feed unlocks ("You're in for today").
- [ ] **A-42 Daily limit (04f).** Ask the agent to set recordings per day to 2 on staging. With an account that hasn't submitted today, record twice and re-record each time without submitting, then tap record a third time. Expected: "Recording limit reached" says you've used all 2 of today's recordings, the limit resets with tomorrow's question, and matches and chats stay available, with a single **Got It** button. No countdown starts. The Feed tab stays locked. Ask the agent to put the setting back to 10.
- [ ] **A-43 No Question Today (04g).** Ask the agent to temporarily remove today's question on staging. Open the app with an account that hasn't answered. Expected: the Feed tab shows "No question yet today", says to check back soon and that you'll get a notification, and has a **Check again** button. You can't record. Matches and Profile still open. Ask the agent to restore the question, then tap Check again. Expected: it switches to Feed Locked with today's question.

### Tab bar and session

- [ ] **A-44 Tabs.** Expected: a bottom tab bar with Feed, Matches and Profile. Matches and Profile are simple placeholders in this phase. Profile has a **Log Out** link.
- [ ] **A-45 Stays logged in.** Close the app completely and reopen it. Expected: you're still logged in and land in the right place (see A-11).
- [ ] **A-46 Log out.** Tap Log Out on the Profile tab. Expected: you're back on Welcome. Reopening the app keeps you logged out.
- [ ] **A-47 Both platforms.** If you have access to both an iPhone and an Android phone, run A-25 to A-37 on each.

---

## Phase B — Feed and browse

Added when Phase B is built.

## Phase C — Profile and archive

Added when Phase C is built.

## Phase D — Social screens

Added when Phase D is built.

## Phase E — Polish

Added when Phase E is built.
