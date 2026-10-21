# Mobile app questions and answers

A record of questions asked while planning the phone app, the options offered,
and Mike's answer. Newest phase first.

## Email unsubscribe landing and settings link (Mike, Oct 20, 2026)

Tapping **Unsubscribe from these emails** in notification mail hits the **`unsubscribe`** Edge Function, turns off **email only** for that **08c** category, then **redirects (GET)** to **`https://catsordogs.net/email-unsubscribed?type=…`** so users never see raw HTML on the Supabase URL. The landing page shows a **type-specific** lead sentence (for example `… regarding Matches.`), the note `You can change this any time in the app's notification settings.`, and orange **Open notification settings**, which links to **`https://catsordogs.net/notifications`** and should open **08c** in an installed build. **POST** one-click unsubscribe in some mail clients returns plain text only (no browser page), with the same settings URL in the body. Full catalog: [notifications.md](notifications.md). **TestFlight / Play:** universal link to **08c** from `/notifications` needs a store build that includes `mobile/app.json` Android intent for `/notifications` and the in-app route handler (**iOS build 6+** in Oct 2026). Unsubscribe and landing pages work without a new app build; only opening **08c** from that HTTPS link needs the newer binary.

## Email Open in the app fallback (Mike, Oct 20, 2026)

Notification emails link to `https://catsordogs.net/user/…`, `/chat/…`, `/question`, or `/matches` (not `catsordogs://`). On the marketing site, **Cloudflare Pages Functions** (`website/functions/user/[id].js` and `chat/[matchId].js`) serve `open-app.html` while the browser address bar **stays** on `/user/{id}` or `/chat/{id}`. That matters for Apple universal links and for the fallback script, which reads the path from the URL.

**Do not** add a Cloudflare dashboard redirect from `/user/*` or `/chat/*` to `/open-app` (with or without a 308). That strips the id, shows "This link could not be read", and can open `catsordogs://open-app` in the app (unmatched route).

**What testers see on iPhone:** Mail often opens Safari first on a short **Open in the app** page (title **Profile** or **Chat** for match/message links). That is normal. Tap **Open in the app** once; allow opening Cats or Dogs? if iOS asks. The installed app should land on the right profile, chat, question, or matches list. Universal links may skip Safari when AASA and Associated Domains are set; the web page is the fallback.

## Chat sent-message bubble color (Mike, Oct 20, 2026)

On **07c**, bubbles you send use a light gray background (`#E0E0E4`) and dark text (`textPrimary`). Incoming bubbles stay dark surface with white text. **Send** stays orange.

## Message push while in chat and feed video on push tap (Mike, Oct 20, 2026)

**In chat (07c):** While a chat is open, the app heartbeats `set_active_chat` on staging/production. The server skips **push** for new messages in that match while the heartbeat is fresh (90 seconds). Foreground banners for that match are suppressed too. Email is unchanged (still rate-limited per hour per thread).

**Push tap crash (build 3):** TestFlight crash log showed `expo-video` releasing the feed player while React reported a fatal JS error during navigation to chat. Mitigations: pause/unmount feed `VideoView` when the feed tab is not focused, pause before `router.push` from notifications, and defer navigation until after interactions. Ship in the next iOS build.

## Match push on TestFlight (Mike, Oct 20, 2026)

Staging showed match-request push **sent** to the TestFlight Expo token; the Matches tab heart is **in-app** (Realtime/poll), not push. Banners were easy to miss with **Do Not Disturb** on. We still install the Expo foreground notification handler at startup and refresh the push token when the app becomes active; that is normal hardening, not a fix for a broken server path.

## Profile build label and camera on question screen (Mike, Oct 20, 2026)

**08 Profile (own):** Below **Log Out**, right-aligned muted text shows **Version X.Y.Z (build)** from the installed binary (TestFlight, Play, or production). The number in parentheses is that binary's build number (the same number TestFlight shows after the version, or the Play version code on Android). Expo Go has no app build number, so it shows **Version X.Y.Z** only. **04 Today's Question:** Camera and microphone permissions are requested when the screen opens, not only when tapping record, so the preview starts in store builds.

## Notification email deep links and push on sign-in (Mike, Oct 20, 2026)

Notification emails (daily question, nudge, match, match request, message) include **Open in the app** using `https://catsordogs.net/...` so one link works on iPhone and Android. Installed builds use universal / app links when the marketing site serves `.well-known` files with `PUBLIC_IOS_TEAM_ID` and Android cert fingerprints. Auth emails still use `catsordogs://` or `exp://` per device at sign-up time. Push registers when the user is signed in on a dev or store build, not only from **08c**.

## Check Your Email after Sign Up (Mike, Oct 19, 2026)

On **02d** after Sign Up: remove **Back to Log In**; the header back arrow goes to **02 Sign Up** (not Log In) with the submitted email prefilled and password cleared so a wrong email can be corrected. Password-reset **02d** (`kind=reset`) keeps **Back to Log In** and back goes to Log In.

## Interests picker search, expand, and limit modal (Mike, Oct 19, 2026)

**03e Interests:** Header search (with clear **x**) filters pills in real time. The search field is compact until focused, then expands across the remaining header width with padding from the **Interests** title. Selection count lives on **Done (N of 5)**. **Done** stays visible above the keyboard. At 5 picks, tapping another pill opens **Interest limit** / **You can only specify 5 interests.** / **OK**. Pencil: **03e Interests**, **03e Interests Search Focused**, **03e Interests Limit**.

## Profile photo required hint above Finish / Save (Mike, Oct 21, 2026)

On **03** and **08d**, when there is no profile photo (position 1), bold red centered text **Profile photos are required** appears above **Finish Setup** or **Save Changes**. It hides as soon as a profile photo is present. Pencil: **03**, **08d** (no hint on **03a** when the avatar is filled).

## Build / Edit Profile field labels: City and School (Mike, Oct 21, 2026)

On **03** and **08d**, the city autocomplete field label is **City** (was **Location**). The school text field label is **School (high school, college, whatever)**. Constants: `PROFILE_CITY_FIELD_LABEL` and `PROFILE_SCHOOL_FIELD_LABEL` in `mobile/src/lib/profileForm.ts`.

## Build Profile featured interests and counter (Mike, Oct 21, 2026)

**03 Build Profile** shows 21 featured interest pills (Art through Yoga, alphabetical) plus **View more >**, with **(N of 5)** beside the **Interests** title. Pills toggle on the profile form; **View more >** opens **03e** with the same picks already selected (`mobile/src/lib/featuredInterests.ts`). A sixth pick on 03 or 03e opens the same limit modal. **Finish Setup** with zero interests opens **No interests?** (primary **Go back and add interests** scrolls to Interests; secondary **Proceed without interests** continues save). Same modal on **08d** **Save Changes**. Pencil: **03**, **03f Build Profile Interests Limit**, **03g Build Profile No Interests Submit**, **08d Edit Profile No Interests Submit**. **08d Edit Profile** uses the same featured grid, **(N of 5)**, and **View more >** as **03** (opens **03e** with current picks).

## Sign Up and Log In: hide Apple/Google until store OAuth (Mike, Oct 19, 2026)

**02 Sign Up** and **02b Log In** do not show Continue with Apple or Continue with Google (no "Coming soon" row) ahead of TestFlight and Play builds. Re-enable both by setting `SHOW_SOCIAL_AUTH` to `true` in `mobile/src/lib/authUi.ts` when OAuth is ready. Pencil **02b Log In** updated to match; frame **02 Sign Up** unchanged from the earlier pass.

## Hosted admin URLs (Mike, Oct 19, 2026)

Staging admin: **https://admin-staging.catsordogs.net/admin/** (Cloudflare Pages + staging Supabase). Production admin: **https://admin.catsordogs.net/admin/** (separate Pages project + production Supabase). Two Pages projects so build-time `VITE_SUPABASE_*` never mix environments. Setup steps in root `README.md` (Admin website). Optional: Cloudflare Access on staging only.

## Sign Up legal links (Mike, Oct 19, 2026)

On **02 Sign Up**, **Terms** and **Privacy Policy** in the agreement line open the marketing site in the system browser: `https://catsordogs.net/terms-of-service` and `https://catsordogs.net/privacy-policy`. URLs come from `mobile/src/lib/legalUrls.ts` (default origin `https://catsordogs.net`; optional override `EXPO_PUBLIC_WEBSITE_URL`). Staging phones still use production legal pages. Same copy on staging and production.

## App icon concepts (Mike, Oct 17, 2026)

Exploration frame **App icon concepts** in `pencil-new.pen` (six 180pt squircle previews). **7. CD monogram (website favicon)** matches the live site favicon (white CD, orange underline, black). Store listing PNGs live in `docs/store-assets/app-icon/` (1024 Apple, 512 Google Play). Wire into `mobile/app.json` / EAS when you ship store builds.

## Admin email on every new report (Mike, Oct 17, 2026)

Each new video flag, profile report, or chat message report queues one email to every admin (`admin_alert` / `moderation_report`). Copy names what was reported and points admins to the moderation queue; reporter identities are never included. A second report from the same person on the same target does not send another email. Notification settings cannot turn these off. See [notifications.md](notifications.md) for subjects and bodies.

## Following badge icon (Mike, Oct 21, 2026)

On feed (**06**), profile heroes (**06j**, **06n**, …), and answer detail (**06k**), the **Following** indicator is a **20×20** orange circle with a white **user-check** icon (Lucide; person outline with check at the shoulder). Reusable Pencil component **Following Badge** (`vveCW`). Accessibility label remains **Following**. Replaces the earlier outlined **Following** text pill (Oct 17, 2026).

## Question history list UI (06c / 06d) (Mike, Oct 16, 2026)

Screen title **Question History** left-aligned in the header row next to the dark circular back button (same pattern as Feed Settings / Your Answers), not centered “Browse Questions”. Each row: orange date **Month Day, Year** on one line; today adds gray **Live now** beside the date (not “Live now · Today’s feed”); question below; past rows show muted **N responses** (today has no count). Search placeholder **Search past questions...**; active search uses orange border/icon and **orange bold** highlights on matching words in titles. One screen for browse and search (06d is a state, not a separate route).

## Pull-to-refresh and Feed tab reload today's feed (Mike, Oct 16, 2026)

If the user picked a past question from Browse Questions and is viewing that day's feed, pull down on the first video reloads and shows **today's** feed again (not the same past day). Tapping **Feed** in the tab bar while already on the Feed tab does the same reload (fresh server fetch for today, first video).

## No "Earlier answers" day-change banner (Mike, Oct 16, 2026)

When the feed rolls to a previous day, only the question pill updates (date and question text). There is no **Earlier answers** banner or other day-change banner on **06** / **06u**.

**Feed chrome (06, Oct 2026):** Question pill = orange bold date · question (no quote/chevron). Top-right: feed settings, then search (opens **06c** with search focused). Bottom: name/age + city; caption (48px collapsed, 2 lines + ellipsis, tap to expand); profile photo, heart, and more stacked on the right (photo on top); progress bar + mute on the row below. No distance or streak on the feed. Pencil: **06 Feed**, **06 Feed Caption Expanded**, **06u**.

**Answer detail (06k / 06ka, Oct 2026):** Same bottom pattern as **06**, plus map pin + **city · distance** under the name; **back** + non-tappable question pill at top (no settings/search). No streak on **06k**. Pencil: **06k Answer Detail**, **06ka Answer Detail (Your Answer)**.

## Feed Settings unsaved changes and save (Mike, Oct 16, 2026)

On **06i**, **Save** stays grey until the user changes a filter or ranking control. Leaving with unsaved edits shows **Discard changes?** with copy about unsaved **feed settings** (same pattern as profile on **03**; Pencil frame **06i Feed Settings Unsaved Changes**). **Save** goes straight back to the Feed tab and refreshes the feed — no saved alert. Pencil **06i Feed Settings** shows **Save** disabled by default (label **Save**, not “Save Preferences”).

## Caption wait timeout on Review (Mike, Oct 16, 2026)

If auto-captions are still pending **8 seconds** after the video is **ready**, stop waiting on Mux: show **No caption.**, enable **Submit Answer**, and let the user edit on **05b**. The server stores that placeholder so submit works; a late Mux caption delivery does not overwrite it.

## City lookup: Open-Meteo or Google Places (Mike, Oct 15, 2026)

Keep the tested Open-Meteo city suggestions. Add Google Places Autocomplete (New) and Place Details (New) as an alternative. Admin Settings (`/admin/settings`) chooses which service to use (`location_provider`: Open-Meteo default, or Google Places). The Google API key is a server secret, not a field on that page. The phone still stores only a city label; it does not talk to Google or Open-Meteo directly.

## Profile hero actions on the city row (Mike, Oct 15, 2026)

On another person’s profile (**06j**, **06n**, **07h**, and the same hero on related overlays), **⋯** and the heart sit on the **city, state, and distance** row, not on the name / Following row. That keeps the Following badge from covering the buttons. City, state, and distance are vertically centered with those buttons.

## Orientation and gender next to age on profiles (Mike, Oct 15, 2026)

On a profile hero (**08**, **06j**, **06n**, **07h**, and the same hero on related overlays), show sexual orientation then gender in smaller type next to age, e.g. **Alex, 29 (straight male)**. Woman displays as **female**, Man as **male**. Only include a value if that person turned the matching **Show … on my profile** switch on. The parenthetical is **bottom-aligned** with the name and age; the orange **Following** icon stays **vertically centered** on that row, to the right of the parenthetical. Own profile never shows Following.

## Notification defaults at sign-up (Mike, Oct 13, 2026)

When someone creates an account, the server seeds **notification_preferences** with **push on** and **email on** for all four types (daily question, matches, messages, nudges). They can turn channels off in **08c**. Older accounts without stored rows still use the legacy fallbacks (email on only for matches).

## Text fields — focus scroll and placeholder (Mike, Oct 13, 2026)

On every text input in the mobile app **except chat**, when the user focuses the field:

1. **Placeholder / helper text inside the field clears** until they leave the field (even if the value is still empty).
2. **The screen scrolls** so the **label above the field** sits **30px** below the top of the scroll viewport (keyboard-aware when needed).

Implemented in shared `TextField`, `AppTextInput`, and `LocationField` via `FIELD_LABEL_VIEWPORT_TOP` in `mobile/src/lib/formScroll.ts`. Chat (`09` / `chat/[matchId]`) is unchanged until Mike specifies chat behavior.

### Build Profile and Edit Profile: no placeholder text (Mike, Oct 14, 2026)

On **Build Profile (03)** and **Edit Profile (08d)**, no text field shows placeholder or helper text inside it (no "Alex", no "January 1, 2000", no height numbers, no example job or school, no sample About Me line, no sample city, no "Add your own" hint). Fields are simply empty until the person types. Labels and the hints written under a field (for example the 18-or-older line under Birthday) stay. The placeholder behavior above still applies to other screens (sign up, and so on).

### Log In: no placeholder text (Mike, Oct 16, 2026)

On **Log In (02b)** and **Sign Up (02)**, the **Email** and **Password** fields show no helper text inside them (no "you@example.com", no dots). The labels stay. Forgot Password and Set New Password still use their placeholders.

### Sign Up subtitle (Mike, Oct 17, 2026)

Sign Up (02) subtitle is **Let's make some magic.** (not "Let's find your people!"). The email field label is **Email (a confirmation link will be sent here)**.

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

On **Build Profile** and **Edit Profile**, photo entry is split: a required **Profile photo** (circular avatar, position 1) at the top, and optional **Additional photos** (2×3 grid for gallery positions 2–7) above the primary button. Viewing profiles (**06j**, **08**) shows the avatar in the hero and **only gallery photos** in the grid.

#### Gender on Build / Edit Profile (03 / 03d / 08d, Oct 2026)

Gender used to offer Woman, Man, and Non-binary only. Decided: **Woman**, **Man**, and a **More >** chip that opens a separate **Gender** screen (**03d**) with 30 single-choice options (Agender through Two-Spirit; full list in the MVP requirements). The **More** chip shows the chosen value (truncated if long) once picked, and tapping it reopens **03d**. A **Show gender on my profile** switch sits under the chips, **on** by default; when off, other people do not see the gender, but it still counts for matching and the Show me filter. Everything chosen from More fails both Show me: Women and Show me: Men (see `feed-rules.md`). One **03d** screen serves both Build Profile and Edit Profile. Design, requirements, Build Plan, feed rules, and UAT (A-20, A-20b, A-20c, D-31c) are updated; database and app code are not yet.

#### Sexual orientation on Build / Edit Profile (03 / 08d, Oct 2026)

Decided: the chips are now Straight, Gay, Lesbian, Bisexual, Asexual, Demisexual, Pansexual, Queer, Questioning (replacing Straight, Gay, Bi-Sexual, Questioning), still optional, but now **single-select** (header "Optional · Choose one"; the earlier "select all that apply, up to 5" is removed). **Lesbian** is a plain option: it is not linked to Show me or Interested in (decided Oct 2026). A **Show orientation on my profile** switch (default on, same wording and rule as the gender switch) sits under the chips; hidden orientation still counts for the Sexual orientation filter. Database and app code are not yet updated (UAT A-20, A-20d).

**Feed Settings defaults (Oct 2026):** **Sexual orientation** in Feed Settings is never pre-selected from Build Profile (always **Any** until the person changes it). **Show me** is seeded on first finish from gender + orientation when Man/Woman (see `feed-rules.md`); genders from **More** always seed **All Genders**, even if orientation was skipped. Man/Woman with no orientation leave **Show me** unset (Any). Later edits on Edit Profile do not change Feed Settings automatically.

#### Interests replace Lifestyle on Build / Edit Profile (03 / 03e / 08d, Oct 2026)

Decided:

- The **Lifestyle** section is now **Interests**. On **Build Profile (03)**, the header shows **Interests**, **(N of 5)** beside the title, and **Optional** on the right. A wrap grid lists 21 featured pills in alphabetical order (Art through Yoga) plus **View more >**, which opens **03e** with whatever is already selected on 03. Featured pills toggle on or off inline; a sixth pick opens the **Interest limit** modal (same copy as on 03e). On **Edit Profile (08d)**, **Interests** matches **03**: featured pills, **(N of 5)**, **Optional**, and **View more >** to **03e** with picks carried over.
- Screen **03e** lists all configured interests as pills in strict alphabetical order. **Done (N of 5)** stays disabled until something on that screen has changed. Leaving 03e with unsaved changes shows the existing **Discard changes?** dialog.
- After **Done** on 03e, Build Profile shows those picks as orange on the featured grid where they appear; picks chosen only on 03e still count toward the **(N of 5)** counter on 03.
- The 5 picks **replace** the old hobby list in the `interests` column, and feed the Shared Interests ranking (the Interests filter was removed; see below).
- Lifestyle tags are removed. So are the **Smoking** and **Drinking** filters and the **Lifestyle Compatibility** ranking signal (Feed Settings, 06i, now has five ranking signals). Every screen that said "Lifestyle" now says "Interests".
- The top row (back arrow, the title **Interests**, and compact **Search** on the right; search expands when focused) is sticky, and the space above **Done** equals the space below it (Pencil 03e and 03e Edited updated). The top row has 12 points of space above and below it. On Android the gap above **Done** is 24 points and does not include the phone's navigation bar; on iPhone it matches the gap below (which includes the home indicator).
- **Done** is always visible: it is pinned at the bottom of 03e while the pill list scrolls above it (Pencil 03e and 03e Edited now show a phone-height screen with the list clipped and Done fixed at the bottom). The list is strictly alphabetical, ignoring capitals, so acronyms sort by their letters (BBQ falls after Basketball and before Beach Bars; DIY after Diving; EDM after E-Sports); the order is stored in `profile_options.sort_order` and the Pencil pills match it. When 5 are chosen, tapping another unselected pill on 03e or on the featured grid on 03 opens **Interest limit** / **You can only specify 5 interests.** / **OK** (Pencil **03f Build Profile Interests Limit**).

#### Photo count row on **06j** and **06n** (removed)

The Pencil headers had **“6 photos ›”** (count + chevron) above the grid even though all photos are already visible.

Options:

- **Keep** the count row as a shortcut to a gallery screen.
- **Remove** the count/chevron on **06j** and **06n**; keep only the **Photos** section title (or title + grid).

Answer: **Remove** the **“6 photos ›”** row on **06j** and **06n**. No separate “see all” affordance — the grid is complete.

If the other person has no gallery photos, the Photos section shows **[First name] hasn't added any photos yet.** (**06jb**, e.g. "Jordan hasn't added any photos yet."). Your own profile keeps the **Add photo** tile.

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

Planning read-through: Build Plan Phase D (“Follow, nudge, match, messages, filters, settings, the more-options menu … Blocked and Not Interested list with Unblock and Undo, flagging”), MVP requirements (matching, messaging, follow/nudge, moderation menus, Feed Settings **06i**, Account **08b–08g** / **08d** / **08c** / **08i**, per-video flag vs profile/message report), Pencil frames **07** (Incoming / Outgoing / Chats segments), **07b–07n**, **07h**, social confirmations **06b**, **06e–06w**, **06i**, **06n** / **06o**, **06z**, and Account **08b–08g** / **08d** / **08c** / **08i**.

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

### Unmatch keeps the chat for the other person (Mike, Oct 16, 2026)

The person who unmatches loses the chat. The other person keeps the history and sees **[Name] unmatched you. You can no longer chat.** They cannot send. There is no email. A block still removes the chat for both people.

The unmatch confirmation (**07n**) has three actions: **Unmatch Only** (primary), **Unmatch & Block**, and **Keep Match**. Unmatch & Block is a block.

Report confirmations for a video (**06g**), a profile (**06q**), and a chat message (**07m**) use the same pattern: **Report Only** (primary), **Report & Block**, and **Cancel**. Report & Block also blocks them. They are not told about the report or the block. After a video or profile report is filed, the acknowledgment is the dark in-app dialog **06ga** (**Report submitted**, **Thanks. We'll review this response.**, orange **OK**), not the phone's system alert.

### Matches tab: open the list that has something new (Mike, Oct 16, 2026)

When the bottom **Matches** heart is filled orange and the person taps **Matches**, open the segment that has the new item: **Chats** if someone sent an unread message, **Incoming** if the only new item is a pending match request. If both are waiting, open **Chats**. When the heart is not lit, stay on the segment they last used.

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

**08** already lists Edit Profile, Feed Settings, Notifications, Privacy & Safety, People I follow, Blocked and Not Interested, and Help & Support (all placeholder except Log Out).

Options:

- **A.** **Wire every Account row in Phase D** per MVP: **08d** Edit Profile (reuse Build Profile fields + Save Changes), **08b** Privacy & Safety (Allow followers + Delete account), **08c** Notifications, **08i** People I follow, **08e–08g** Blocked and Not Interested list, **06i** from Feed Settings row, Help & Support opens the admin **Help URL** when set. *(Recommended.)*
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
Questions (06c/06d), the Question Pill, rolling to earlier days (06u; pill only, no day-change banner), the "You're all caught up" end screen (06v), and streak badges on feed
videos. **Phase D** is where heart (match), the more-options menu (follow, report,
block, Not Interested), and Feed Settings (06i) live.

Options:

- **Core only:** Today's feed (06): full-screen videos, captions, skip after
  minimum watch, followed section looks distinct, Question Pill. Defer browse,
  day rollover, end screen, and streak badge to a fast follow-up.
- **Feed + browse (recommended):** Everything in core, plus Browse Questions and
  search (06c/06d), opening a past day's feed, day rollover (06u),
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

## Sign-in lands on Feed Locked (Oct 2026)
- Signing in or reopening the app with a finished profile always opens the **Feed** tab. If today is unanswered, that is **Feed Locked (06m)**, not Today's Question. Recording still starts from **Answer Today's Question** on that screen, or from **Record My First Answer** on How It Works after first setup. *Decided by Mike.*

## Confirmation pronouns (Oct 2026)
- Woman → she/her/her; Man → he/him/his; any More gender or missing → they/them/their. Dialogs that use pronouns: Follow, Unfollow, Nudge, Match send (**06b** / **07i**), cancel request (**07f** / **06y**), decline (**07g**), Not Interested (**06f** / **06w**). Accept incoming match (**07j**) uses the person's name in the title and body, not pronouns. Report, Block, Unmatch, and mute chat use the person's name and do not switch pronouns. *Decided by Mike.*

## People I follow (Oct 2026)
- Account on **08** has a **People I follow** row after Privacy & Safety and before Blocked and Not Interested. It opens **08i**: everyone the user currently follows (profile photo, name, age, and **Followed on [date]** under the name, same subtitle placement as Outgoing on **07e**) with **Unfollow** (same 06s confirmation) and **View Profile**. Cards match Outgoing on **07e**. Empty **08ia**: "You're not following anyone yet."
- This list is only people *you* follow. Who follows you stays a count (identities private). The `follows` table stays closed to the app; `get_people_i_follow` is a server function. *Decided by Mike.*

## Deleting your own video (Oct 2026)
- On your own answer (**06ka**) the heart is hidden. More options opens a sheet (**06kb**) with only **Delete video** and **Cancel**. Delete video asks for confirmation (**06kc**, or **06kd** when it is today's answer), then returns to your profile.
- **Deleting today's answer closes the feed again** until a new answer is submitted today. The dialog says so (06kd). *Decided by Mike.*
- **Deleting does not give a recording back.** The deleted recording still counts toward the recordings-per-day limit, so deleting and re-recording cannot get around the cap. The recording can never be submitted again. *Recommended option, accepted by Mike.*
- **Streaks are recalculated from the answers that remain**, so deleting a past answer leaves a gap. *Decided by Mike.*
- An open flag review for a deleted answer is closed automatically; flag and review records are kept without the video. *Assumed, not asked.*
- Deleting is permanent (video file at Mux, captions, view counts). There is no undo and no grace period, like account deletion.
