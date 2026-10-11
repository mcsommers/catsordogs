# Mobile app questions and answers

A record of questions asked while planning the phone app, the options offered,
and Mike's answer. Newest phase first.

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
