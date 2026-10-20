# Put Cats or Dogs? on other people's phones

This is the path that lets people outside your office install Cats or Dogs? on their own iPhones and Android phones. They will not use Expo Go, and your Mac does not have to stay on.

What they install:

- **iPhone:** Apple's TestFlight app, then Cats or Dogs? inside it.
- **Android:** a testing version from the Google Play Store.

That is store testing. It is not the public App Store or the public Play Store. Testers get in by an invite or a link you send. Strangers browsing the stores will not see the app. Putting it on the public shelves is a later, separate step at the end of this doc. Do not tap **Release** or **Submit for Review** for a public launch while you are only trying to get testers on.

## Order of work

Do the numbered steps in order, with two exceptions: **steps 5 and 6** can run in parallel (Apple and Google), and **step 4** must be done before testers record answers, but not before you create the store listings or upload a build.

| Step | What | Status on this Mac (Oct 2026) |
| --- | --- | --- |
| [1](#step-1-confirm-the-two-paid-accounts) | Apple Developer ($99/yr) and Google Play ($25 once) | You confirm enrollment |
| [2](#step-2-ask-the-agent-to-prepare-the-app-project) | `app.json`, `eas.json`, link Expo project | Done |
| [3](#step-3-put-the-staging-keys-on-expos-build-service) | Staging Supabase keys in Expo **preview** env | Done |
| [4](#step-4-add-questions-past-october-26) | More daily questions on staging admin | Before you invite testers |
| [5](#step-5-create-the-app-on-apple) | Bundle ID, App Store Connect app, metadata | In progress if you are here |
| [6](#step-6-create-the-app-on-google) | Play Console app and required forms | Can do alongside step 5 |
| [7](#step-7-build-and-upload) | `eas build` and `eas submit` (needs step 1 and 5a) | After 5a; 5d can stay incomplete |
| [8](#step-8-install-it-yourself-on-staging) | TestFlight or Play internal on your phone | Before inviting others |
| [9](#step-9-invite-people-outside-your-office) | External TestFlight or Play testing links | Needs step 4 for recording |
| [10](#step-10-later-builds) | New builds when the app changes | Ongoing |

**Not part of TestFlight testing:** [Public release, when you want it](#public-release-when-you-want-it) (production database and store review). **Reference while filling Apple/Google forms:** [Data to declare on both stores](#data-to-declare-on-both-stores).

Checked on October 19, 2026 against this repo, the Expo account on this Mac, and both Supabase projects. If a later change lands in the app, ask the agent to update this doc in the same pass.

## Which database testers use

**Staging.** The same database as your Expo Go phone: "Cats or Dogs - Staging" (`pgwnqasselhstrechmsa`). Their videos go to Mux Staging, not Mux Production.

That matches what this round is for. Testers are trying the app. They are not the public launch. The production database stays empty of their accounts until you decide to launch, which is also when the Build Plan says a lawyer should have reviewed storing real people's facial video in Mux Production.

The privacy policy, terms, and community guidelines are already on the site, and the app links to them even from a staging build:

- https://catsordogs.net/privacy-policy
- https://catsordogs.net/terms-of-service
- https://catsordogs.net/community-guidelines

Account deletion is in the app: **Profile → Privacy & Safety → Delete account**.

One consequence: your phone and their phones share staging. A tester can show up in your feed, and your test accounts can show up in theirs. The admin site for this is the one you already use, https://admin-staging.catsordogs.net/admin/ . Their sign-ups, videos, and reports land there too.

## What is already done

These were checked. You do not need to rebuild them.

| Piece | Staging | Production |
| --- | --- | --- |
| Database migrations | Matches the files in this repo | Matches the files in this repo |
| App server functions (upload, playback, captions webhook, location, notifications, delete) | Deployed | Deployed, same code as staging |
| Mux, Resend, and notification secrets | Set. Test mode is off | Set. Test mode is off. Mux keys are the production keys, not a copy of staging |
| Notification worker | Row points at the staging function. The scheduled jobs are on | Row points at `https://fvnbcofflierdlnnglko.supabase.co/functions/v1/process-notifications`. The same three scheduled jobs are on |
| Sign-up email | Resend, from Cats or Dogs? &lt;noreply@catsordogs.net&gt;. A new account is not signed in until the person taps the link | Same sender and same rule |
| Email links (auth) | Each sign-up or reset email contains one return address. Expo Go asks for an `exp://` link. An installed build asks for a `catsordogs://` link. Staging allows both kinds | Production allows only `catsordogs://auth-callback` for auth |
| Email links (notifications) | Match, message, nudge, and daily-question emails include **Open in the app** (`https://catsordogs.net/question`, `/chat/…`, `/user/…`, or `/matches`). Same URL on every phone. The marketing site serves `/user` and `/chat` paths via Pages Functions (see root `README.md`). Universal links can open the installed app directly when `PUBLIC_IOS_TEAM_ID` and Android fingerprints are set; otherwise, or on iPhone from Mail, Safari may show a short **Open in the app** page first (tap the button) | Same |
| Daily questions | Through October 26, 2026 | Through October 26, 2026 (20 questions, next one is today) |
| City lookup setting | Google Places | Open-Meteo. The Google Places key is already stored in the production function secrets |
| Admins | 2, at https://admin-staging.catsordogs.net/admin/ | **0.** Not needed until a public launch |

Your day-to-day phone setup is already staging. `mobile/.env` points at `https://pgwnqasselhstrechmsa.supabase.co`. Leave that file alone. The testing build gets the same staging address from Expo's build service. It does not read `mobile/.env`.

Expo store prep (steps 2 and 3) is done on this Mac:

- `mobile/app.json`: bundle id and package `net.catsordogs.app`, iPad off, export compliance flag set, linked to EAS project `50bf2ee6-7e99-4f00-960c-46123308779e` ([@mcsommers/cats-or-dogs](https://expo.dev/accounts/mcsommers/projects/cats-or-dogs)).
- `mobile/eas.json`: **preview** profile for store binaries against staging.
- Expo **preview** environment variables: staging Supabase URL and anon key, plus `EXPO_PUBLIC_WEBSITE_URL`.

Still yours to confirm before the first build:

- Apple Developer Program and Google Play Console enrollment (step 1).

## Your phone and their phones

| | Your phone, every day | Testers' phones |
| --- | --- | --- |
| How the app is installed | Expo Go, started with `cd mobile && npm run phone` | TestFlight or the Play testing track |
| Which database | Staging | Staging, the same one |
| Where the keys live | `mobile/.env` on your Mac | Expo's build service (EAS), baked in when the store app is built |
| Your Mac | Has to be on, with `npm run phone` running | Can be off |

The word "production" shows up in Expo and in the stores for a different idea: a store binary, as opposed to Expo Go. That name does not mean the production database. This testing build is a store binary pointed at staging.

Email still behaves the way it does now. A link requested from Expo Go opens Expo Go. A link requested from the installed app opens the installed app. Staging allows both. Production is not involved.

The public anon key is safe to put in the app. It is the same kind of key already in `mobile/.env`. It is not a password. Never put the service role key, Mux keys, or Resend key into the app or into EAS.

## Step 1. Confirm the two paid accounts

These are not in the project. Only you can create them. The agent cannot enroll you.

1. **Apple Developer Program**, $99 a year: https://developer.apple.com/programs/
   Enrollment can take a few days and sometimes a phone call. Start this first. TestFlight does not exist without it.
2. **Google Play Console**, $25 once: https://play.google.com/console/signup
   Use the Google account you want to own the app listing. Testers will see the developer name you enter here.

You need the Account Holder or Admin role on both. A lower role can upload a build and still be blocked from inviting outside testers.

## Step 2. Ask the agent to prepare the app project

Do this once, before the first build. Ask the agent to make the edits. The values below are the ones to use so the iPhone app and the Android app stay the same product.

In `mobile/app.json`:

- iOS bundle id: `net.catsordogs.app`
- Android package name: `net.catsordogs.app`
- iPad: turn **off** tablet support (`supportsTablet` is currently true). The screens are designed for a phone. Leaving iPad on makes Apple ask for iPad screenshots and offer the app on iPad.
- Encryption flag: set iOS `usesNonExemptEncryption` to false. The app uses ordinary sign-in encryption and HTTPS, including a helper (`react-native-quick-crypto`) so sign-in works outside Expo Go. Recording the flag here stops TestFlight from sitting on "Missing Compliance" after every upload. If Apple's form still asks, say the app only uses encryption for sign-in and secure connections.

Add `mobile/eas.json` with a preview profile that:

- builds a store binary (the kind TestFlight and Play accept)
- reads Expo's **preview** environment, which you will fill with the **staging** database address
- lets Expo number each upload (`autoIncrement`)
- sends the Android file to the Play **internal testing** track, never straight to the public listing

Suggested file:

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "store",
      "environment": "preview",
      "autoIncrement": true
    }
  },
  "submit": {
    "preview": {
      "android": {
        "track": "internal"
      }
    }
  }
}
```

Then, from the `mobile` folder, the agent (or you) connects the app to Expo:

```sh
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init` creates the Expo project and writes its id into `app.json`. Sign in as **mcsommers** if it asks. The bundle id and package name cannot be changed after the first upload to Apple or Google. `net.catsordogs.app` matches the site catsordogs.net. Stick to it on both stores.

Continue with Apple and Google sign-in buttons hidden. They are off on purpose (`SHOW_SOCIAL_AUTH` is false). Email and password is the sign-up path reviewers and testers will use. Turning those buttons on needs a separate Apple and Google sign-in setup.

## Step 3. Put the staging keys on Expo's build service

A cloud build cannot see `mobile/.env`. If these variables are missing, the installed app has no database to talk to. They are the same staging values already in `mobile/.env`.

Ask the agent to set them. The agent can read the anon key on this Mac and send it to Expo without pasting it into chat. The commands, from `mobile`, are:

```sh
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://pgwnqasselhstrechmsa.supabase.co --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value '<staging anon key>' --environment preview --visibility sensitive
npx eas-cli@latest env:set --name EXPO_PUBLIC_WEBSITE_URL --value https://catsordogs.net --environment preview --visibility plaintext
```

The staging anon key is the line named `anon` from:

```sh
npx supabase projects api-keys --project-ref pgwnqasselhstrechmsa
```

Visibility `sensitive` keeps the anon key out of build logs. It still ends up inside the app, which is normal for this kind of key.

Do not put the production Supabase address in the preview environment.

## Step 4. Add questions past October 26

Staging already has admins, Google Places for city lookup, and a question for each day from today through October 26, 2026. Nothing else on the server has to change before testers join.

After October 26 there is no question. Testers with no question for the day cannot record and cannot open the feed. Before you invite them, open https://admin-staging.catsordogs.net/admin/ and add questions for the days after October 26.

## Step 5. Create the app on Apple

Do this in order. App Store Connect will not let you type a bundle ID. You choose one from a menu, and that menu only lists IDs you already registered in the Apple Developer account. The ID must match `mobile/app.json` (`net.catsordogs.app`). Apple’s help text mentions Xcode; this project uses Expo instead, but the same rule applies: register the ID first, then pick it in App Store Connect. You cannot change the bundle ID after the first build upload.

### 5a. Register the bundle ID in the Apple Developer account

1. Sign in at [Apple Developer](https://developer.apple.com/account) with the same account you use for App Store Connect.
2. Open **Certificates, Identifiers & Profiles** → **Identifiers**.
3. Click the **+** button.
4. Choose **App IDs** → **App** → **Continue**.
5. Fill in:
   - **Description:** `Cats or Dogs` (a label only you see in the developer portal).
   - **Bundle ID:** choose **Explicit**, then enter exactly `net.catsordogs.app`.
6. Under **Capabilities**, turn on **Push Notifications** (store builds use Expo push for daily questions and matches) and **Associated Domains** (so notification email links on `catsordogs.net` can open the installed app). Leave the rest off unless you add a feature later. **Sign in with Apple** is not in the app yet.
7. Click **Continue**, then **Register**.

**Already registered the ID before Associated Domains was required?** In **Identifiers**, open `net.catsordogs.app` → **Capabilities** → enable **Associated Domains** → **Save**. Then run a new `eas build` for iOS. Expo will create a new provisioning profile that includes that capability. If a build fails with a message that the profile does not include Associated Domains, you skipped this step.

If `net.catsordogs.app` does not show up in App Store Connect right away, wait a minute and refresh the page. If it still missing, confirm the Apple Developer Program enrollment is **active** (not pending) and that you are on the same Apple team in both portals.

The first `eas build` for iOS can also create credentials on your Apple account, but registering the identifier here is what unlocks the **New App** form in App Store Connect.

### 5b. Create the app in App Store Connect

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com).
2. **Apps → New App** (the `+`).
   - Platform: iOS
   - Name: `Cats or Dogs?`
   - Primary language: English (U.S.)
   - Bundle ID: choose `net.catsordogs.app` from the menu (registered in 5a)
   - SKU: `cats-or-dogs` (an internal id only you see)
   - User access: full
3. Click **Create**.

### 5c. Sidebar items (not the long version form)

Open these from the left sidebar under your app. Do them once; they are separate from the **iOS App Version 1.0** page in 5d.

**App Information** (under **General**):

- Privacy Policy URL: `https://catsordogs.net/privacy-policy`
- Category: **Lifestyle** (Apple has no Dating category). Secondary category: optional.
- Content rights: you are not using third-party music or video you do not own.

**Age Rating** (questionnaire):

- Answer from what the app actually does. It is for adults 18 and older. People record their own video and audio, chat with matches, and can report or block someone. There are no ads. The questionnaire will likely land at **17+**. That is Apple's top age band. The app itself still refuses anyone under 18.

**App Privacy** (Privacy Nutrition Labels):

- Required before **external** TestFlight or the public App Store. Use the table in [Data to declare on both stores](#data-to-declare-on-both-stores) in this doc.

**Pricing and Availability:**

- Set the app to **Free** when you open that section.

### 5d. Distribution tab: iOS App Version 1.0 (Prepare for Submission)

After **Create**, Apple often opens **Distribution** → **iOS App** → **Version 1.0** with status **Prepare for Submission**. This page is for the **public App Store**. You do **not** need to finish it or tap **Add for Review** to start **TestFlight**. Upload a build first (step 7), then use the **TestFlight** tab for testers.

| When | What to do |
| --- | --- |
| **Internal TestFlight** (only App Store Connect team) | Skip most of this page. Upload a build, then TestFlight. |
| **External TestFlight** (friends outside your team) | Fill **App Review Information** below and complete 5c (age rating, App Privacy). Screenshots can still wait. |
| **Public App Store** | Fill everything marked required on this page, attach a build, then **Add for Review**. |

Work top to bottom on the version page:

**App Clip / iMessage App**

- Skip. Not used.

**Previews and Screenshots** (iPhone 6.9", 6.5", and other sizes)

- Not required for internal TestFlight. Required before the public App Store. Leave empty until you have 2+ real iPhone screenshots from the installed app (use a staging account so you are not publishing someone else's video).

**Promotional Text** (optional)

- Leave blank, or use: `One video question a day unlocks everyone else's answers.`

**Description** (required when you submit this version to the App Store)

- Not blocking the first internal TestFlight build. Starting text:

```
Cats or Dogs? is a dating app where everyone answers the same question on camera before they can watch anyone else's answers.

Each day there is one question. You record a short answer. That unlocks a feed of other people's answers. You can follow people, send a match request, and chat when it is mutual.

You must be 18 or older. You can block or report someone from their video or profile. You can delete your account at any time from Profile, Privacy & Safety.
```

**Keywords** (required when you submit this version to the App Store)

- Comma-separated, no spaces after commas, 100 characters max. Example: `dating,video,authentic,match,chat,singles`

**Support URL** (required)

- `https://catsordogs.net/support`

**Marketing URL** (optional)

- Leave blank, or `https://catsordogs.net`

**Version**

- `1.0` (matches `mobile/app.json`).

**Copyright** (required for App Store submit)

- Example: `2026 Cats or Dogs?` or your legal entity name.

**Routing App Coverage File**

- Skip.

**Build**

- Stays empty until step 7 (`eas build` and `eas submit`). After Apple processes the upload, the build appears under **TestFlight** and can be selected here for a public release later.

**Export compliance (yellow banner about encryption)**

- `mobile/app.json` sets `ios.config.usesNonExemptEncryption` to `false` for store builds. If TestFlight still shows **Missing Compliance** on a build, open that build in TestFlight and answer that the app does not use non-exempt encryption, or upload a new build after step 2 is in place.

**App Review Information** (red fields when empty)

- Required for **App Review** (public App Store or external TestFlight). Use a **staging** account you create in the **installed** TestFlight app, not Expo Go. Do not put that password in git, this doc, or chat.

| Field | What to enter |
| --- | --- |
| Sign-in required | Checked |
| User name | Staging test email (for example `catsordogsapp+review@gmail.com`) |
| Password | Password for that account (App Store Connect only) |
| First name, last name, phone, email | Your contact details for Apple (for example `catsordogsapp@gmail.com` for email) |
| Notes (optional) | `18+ dating app. Email/password sign-up; open confirmation email on the same phone. Daily video recording unlocks the feed. Report and Block on profile/video. Delete account: Profile → Privacy & Safety.` |
| Attachment | Skip |

**App Store Version Release**

- Choose **Manually release this version** while you are only testing, so an approval does not publish the app to the store by accident.

**Save** vs **Add for Review**

- **Save** is fine anytime to store draft metadata.
- Do **not** tap **Add for Review** until you intend to ship on the **public** App Store. Testers use **TestFlight**, not this button.

Icons for a future public listing are in the repo. See `docs/store-assets/README.md`.

- Apple: `docs/store-assets/app-icon/app-icon-1024.png` (square, no rounded corners)
- Google: `docs/store-assets/app-icon/app-icon-512.png`

## Step 6. Create the app on Google

**Reminder (when you start Android, not needed for iOS-only TestFlight):** Notification emails use the same `https://catsordogs.net/...` links on every phone. On Android, those links open the installed Play build directly only if the **marketing site** (Cloudflare Pages for **catsordogs.net**) has **`PUBLIC_ANDROID_SHA256_CERT_FINGERPRINTS`** set. Use the SHA-256 certificate fingerprints from Play Console (**App integrity** / app signing) or from `eas credentials` after your first Android upload. Comma-separate if there is more than one. Redeploy the marketing site after you add it. Until then, the link still works but may show the simple **Open in the app** web page first. iOS uses **`PUBLIC_IOS_TEAM_ID`** instead; see step 7 and the root `README.md`. On **iPhone**, Mail often shows that web page even when universal links work; testers tap **Open in the app** once. Do **not** add a Cloudflare redirect from `/user/*` to `/open-app` (it breaks match emails).

1. Open [Google Play Console](https://play.google.com/console) and click **Create app**.
   - App name: `Cats or Dogs?`
   - Default language: English (United States)
   - App or game: App
   - Free
   - Accept the declarations
2. When it asks for the category, choose **Dating**.
3. Fill every task Play Console marks as required before a testing release can go out. New apps are blocked until these exist:
   - Short description and full description. A starting point is below. Edit it in your own words before you save.
   - App icon: `docs/store-assets/app-icon/app-icon-512.png`
   - A feature graphic, 1024 by 500 pixels. There is not one in the repo yet. Ask the agent to export one from the app icon artwork if you want it made here.
   - Phone screenshots. At least two. Use your own staging account so you are not publishing someone else's video. The screens look the same as they will for testers.
   - Privacy policy URL: `https://catsordogs.net/privacy-policy`
4. Complete the **content rating** questionnaire (IARC), the **Data safety** form, and the **ads** declaration. Ads: the app has none. Use the data list in the next section for Data safety. Target age: 18 and older.
5. Under **App content**, declare that the app has user-generated content and that users can report and block. In the app, **Report** and **Block** are on a person's video and profile. Account deletion is **Profile → Privacy & Safety → Delete account**. Support URL: `https://catsordogs.net/support`

Do not start a **Production** release. Testing uses **Internal testing** first, then **Closed testing** if you want a link instead of a list of emails.

### Store text you can edit

Short description (Play allows 80 characters):

`Answer one short video question a day. Then see who else did.`

Full description, first draft:

```
Cats or Dogs? is a dating app where everyone answers the same question, on camera, before they can watch anyone else.

Each day there is one question. You record a short answer. That unlocks a feed of other people's answers. You can follow people, send a match request, and chat when it is mutual.

You must be 18 or older. You can block or report someone from their video or profile. You can delete your account at any time from Profile, Privacy & Safety.
```

## Data to declare on both stores

Answer from this list. The app does not include an ads or analytics tracker. It does not read the phone's GPS. Location is a city the person types.

| Data | How it is collected | Shared with |
| --- | --- | --- |
| Email, password, name, birthday, gender, pronouns, photos, interests, about text | The person types or picks it | Supabase (the database) |
| Video, audio, and captions of daily answers | Recorded in the app | Mux (video hosting) and Supabase |
| City, and coordinates for that city so distance works | The person types a city | Supabase, and Open-Meteo or Google Places for the lookup |
| Messages, match requests, follows, blocks, reports | Done in the app | Supabase. Follower identities are not shown to other people |
| Time zone | Sent so the daily question uses their local day | Supabase |
| Push token, if they allow notifications | The phone's notification service | Expo, which hands the notification to Apple or Google |
| Device type and app version | Sent with normal app requests | Supabase |

Not collected: contacts, precise GPS, advertising ID, browsing history outside the app, health data, financial data.

Not sold. Deleted when the person deletes the account, except anonymized moderation records described in the privacy policy.

Service providers to name if a form asks: Supabase, Mux, Resend (email), Expo (push), and either Open-Meteo or Google (city lookup).

## Step 7. Build and upload

Stay at the Mac the first time. Expo will ask you to sign in to Apple and to approve encryption and push credentials. Say yes when it offers to create the Apple push key and the Android push credentials. Those are what let daily-question and match notifications reach a real phone. They do not work in Expo Go.

The home-screen icon comes from `mobile/assets/icon.png` (CD monogram, copied from `docs/store-assets/app-icon/`). If TestFlight still shows the old Expo template icon, run a **new** iOS `eas build` and `submit` after pulling the latest `mobile/assets` files. The same build picks up universal-link settings (`applinks:catsordogs.net`). Set `PUBLIC_IOS_TEAM_ID` on the marketing site deploy so notification email links can open the installed app (see root `README.md`). **Profile** on the installed build shows **Version X.Y.Z (build)** under **Log Out** so you can tell builds apart. After a marketing deploy, confirm `https://catsordogs.net/user/{uuid}` keeps `/user/…` in the address bar (not a bare `/open-app` with no id).

Build on Expo's servers. You do not need Xcode or Android Studio.

From `mobile`:

```sh
npx eas-cli@latest build --platform ios --profile preview
```

When that build has finished:

```sh
npx eas-cli@latest build --platform android --profile preview
```

The first build of each takes roughly 15 to 30 minutes. Expo emails you and prints a page to watch. If it stops because the free plan's monthly build count is used up, the Expo site says so. Ask the agent before paying for a larger plan.

Then upload.

iPhone:

```sh
npx eas-cli@latest submit --platform ios --profile preview
```

Pick the preview build it just made. The first time, sign in with the Apple account that owns the developer program. If `eas submit` asks which profile, choose **preview**. The build shows up in App Store Connect under **TestFlight** after Apple processes it, often 10 to 15 minutes, sometimes longer. If the row says **Missing Compliance**, the encryption flag from step 2 was not in the build. Ask the agent to confirm it, then build again.

Android needs one extra key before the first upload. EAS cannot press the buttons in Play Console by itself.

1. Follow Expo's guide for a Google Service Account key, linked from https://docs.expo.dev/submit/android.md (the section "Create a Google Service Account key").
2. In Play Console, invite that service account with permission to release to testing tracks.
3. Download the JSON key. Do not commit it and do not paste it into chat.
4. Store it on Expo:

```sh
cd mobile
npx eas-cli@latest credentials --platform android
```

Choose the preview profile, then **Google Service Account → Manage your Google Service Account Key for Play Store Submissions**, and point it at the JSON file. If it asks which submit profile, choose **preview**.

5. Upload:

```sh
npx eas-cli@latest submit --platform android --profile preview
```

The first upload lands on the **internal testing** track and can sit as a draft until you open Play Console and roll that release out. Roll it out to internal testing only.

This Google key is only for uploading the app. It is not the Firebase key used for push, and it is not a Supabase key.

## Step 8. Install it yourself on staging

Do this before you invite anyone else. You want one clean pass in the installed app, against the same staging database Expo Go already uses.

**iPhone.** You are on the Apple team, so you can use TestFlight internal testing without Apple's beta review.

1. In App Store Connect, open the app → **TestFlight**.
2. If there is no internal group, create one (the `+` next to **Internal Testing**). Add yourself.
3. On your iPhone, install Apple's **TestFlight** app, open the invite, and install **Cats or Dogs?**
4. This icon is separate from Expo Go. Expo Go can stay installed. Both talk to staging. Expo Go still needs `npm run phone`. The installed app does not.

**Android.**

1. Play Console → **Testing → Internal testing**. Add the Gmail address on your Android phone as a tester and copy the opt-in link.
2. On that phone, open the link, accept the test, and install from the Play Store. The Play Store may take a few minutes to show the app after you opt in.

**Sign up inside that installed app** with a new email, or log in with a staging account you already have. An email that already exists on staging cannot sign up again.

1. For a new account: sign up, password at least 8 characters. Open the confirmation email **on that same phone** and tap the link. It should open Cats or Dogs?, not Expo Go, and land on Build Profile.
2. Finish the profile far enough to get into the app (18 or older, required photos).
3. Record one answer and confirm it plays. This uses Mux Staging, the same video setup as Expo Go. If Record says "We could not start the upload," stop and ask the agent to check staging before anyone else joins.

You do not need a new admin. Staging already has two. Questions and reports are at https://admin-staging.catsordogs.net/admin/ .

## Step 9. Invite people outside your office

### Friends and family = external TestFlight

If your first testers are you plus friends and family, plan on **external** TestFlight on iPhone, not internal.

| Apple's label | Who counts |
| --- | --- |
| **Internal** | People on your **App Store Connect team** (Users and Access), using Apple IDs you invited as team members. Usually you and any co-founder, not casual testers. |
| **External** | Everyone else: friends, family, partners, anyone not on that team. |

Do **not** add friends and family as App Store Connect users just to avoid Beta App Review. Give them a **TestFlight public link** or email invite from an **external** group instead.

External testing needs more setup before the link works: primary **category**, **age rating**, **content rights**, and **App Privacy** (step 5c), a uploaded build (step 7), then **Beta App Review** once per app version. You still do not need the public App Store screenshots page or **Add for Review**.

On Android, use **closed testing** (or internal with each person's Gmail on the list), not the Play **Production** track. See below.

### iPhone: external TestFlight

Internal testing only reaches people you add to App Store Connect (your Apple team, up to 100). Everyone else needs an **external** group. Apple reviews the first build of each version before those testers can install it. Later builds of the same version are often faster. Have an internal group first; Apple requires that before it allows an external group.

1. TestFlight → `+` next to **External Testing** → name the group (for example `Friends`).
2. Add the build you already uploaded.
3. Fill in **Test Information**:
   - Beta description: what the app is, in a few sentences. You can reuse the full description from step 6.
   - Feedback email: `catsordogsapp@gmail.com`
   - Sign-in required: **yes**. Apple's reviewer has to get past sign-up. Use the staging account you created in step 8, or a second staging account you create the same way. Put that email and password in the sign-in fields. Do not put that password in this doc, in git, or in chat.
   - Contact information: the same email, and a phone number Apple can use.
4. Notes for the reviewer, in plain language:
   - The app is 18+ dating. Sign up is email and password. Apple and Google buttons are not shown.
   - Open the confirmation email on the phone that has the app installed.
   - Recording the daily answer unlocks the feed. Camera and microphone are only for that recording. Photos are only for the profile.
   - Report and Block are on a person's video and profile. Delete account is under Profile → Privacy & Safety.
   - Privacy policy: https://catsordogs.net/privacy-policy
5. Submit for Beta App Review. Wait for the email that it is approved. Then turn on the **public link** for the group, or add testers by email.

Send testers this:

```
Install Apple's TestFlight app, then open this link: <paste the TestFlight public link>
Install Cats or Dogs?
Create an account with your email. You need to be 18 or older.
Open the confirmation email on this same phone and tap the link. It should open Cats or Dogs?
Your own phone's camera and microphone are used only when you record your answer.
```

A TestFlight build expires 90 days after upload. Testers get a new build when you upload one and add it to the group.

### Android: internal list, or a closed-test link

**Marketing site (app links from email):** After your first Android build is on Play, set **`PUBLIC_ANDROID_SHA256_CERT_FINGERPRINTS`** on the **catsordogs.net** Cloudflare Pages project and redeploy. Same idea as **`PUBLIC_IOS_TEAM_ID`** for iPhone. See the reminder at the top of step 6.

**Internal testing** is the fastest. Up to 100 people, by email, no Google review. Each person must use the Google account you listed, open your opt-in link, and install from the Play Store.

**Closed testing** is the one to use when you want a link you can text to people without typing every Gmail address first. The first closed release is reviewed by Google. Create the track under **Testing → Closed testing**, add the same app bundle (or promote the internal release), and roll it out. Then copy the opt-in link from the **Testers** tab.

Send testers this:

```
Open this link on your Android phone: <paste the Play opt-in link>
Join the test, then install Cats or Dogs? from the Play Store.
Create an account with your email. You need to be 18 or older.
Open the confirmation email on this same phone and tap the link.
```

Play Console sometimes requires a closed test with a minimum number of testers for 14 days before a brand-new personal account can ship to the public store. That rule does not block internal or closed testing. When you are ready to go public, read the banner in Play Console and follow whatever it asks for then.

## Step 10. Later builds

When the app changes and testers need the new code:

1. Ask the agent to confirm staging migrations and functions are deployed (`db push` and `functions deploy` on `pgwnqasselhstrechmsa`) if server rules changed.
2. From `mobile`, run the same `eas build` and `eas submit` commands as step 7.
3. iPhone internal testers get the new build after Apple finishes processing. External testers get it after you add the build to their group. A new version number can require Beta App Review again.
4. Android testers get the update from the Play Store after you roll out the new release on the same testing track.

Keep using `--profile preview`. Do not change `mobile/.env` as part of a store build.

## What not to do

- Do not submit the public App Store version (**Distribute → App Store → Submit for Review**) until you mean for anyone to download it.
- Do not roll the Play release out to **Production**.
- Do not run staging seed scripts against production. `supabase/seed-staging-feed.mjs` refuses production. Leave it that way.
- Do not point this testing build at the production database. Production is for the public launch, after the legal review in the Build Plan.
- Do not put outside testers on Expo Go. Their phones would depend on your Mac staying on.
- Do not turn on Continue with Apple or Continue with Google in the same pass as this testing build. Those buttons are hidden until that sign-in setup exists.

## Public release, when you want it

Only after testing looks right, and after you have read Apple's current dating and user-generated-content rules and Google's current Data safety and dating rules. They change. The Build Plan calls this out as its own checkpoint. Real people's videos would then go to Mux Production, which the Build Plan says needs a legal review first.

Switching the app from staging to the production database is a new build. Accounts, videos, and matches on staging do not move. Ask the agent to put the production Supabase address in an Expo production environment and build with that profile. Before that build, production still needs an admin (it has none today) and this redirect on the production project, under **Authentication → URL Configuration**:

`https://admin.catsordogs.net/**`

Leave `catsordogs://auth-callback` in place. Do not add `exp://` on production.

- **Apple:** App Store Connect → the iOS app version → add screenshots, description, support URL `https://catsordogs.net/support`, and the reviewed build → **Submit for Review**. Review is often a day and can be longer for a dating app.
- **Google:** promote a tested release to **Production** and send it for review. Check the closed-testing requirement in Play Console first. "Production" on that screen means the public Play listing. It is a separate step from pointing the app at the production database.

Ask the agent to walk that submission with you when you get there. It should not be part of the first testing upload.
