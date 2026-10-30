# Feed vertical scroll (locked UX)

Mike approved this pattern in Phase B (Oct 2026). **Do not change it without an explicit product decision** and updates to this file, MVP requirements, UAT, and Pencil screen **06**.

## What the user experiences

- The feed is a **vertical, full-screen pager** (one answer per “page”).
- When they swipe up or down, **everything on that answer moves together**: the video, the top chrome (question label, feed settings, search), the poster row (name/age, city, **Following** when applicable), caption, vertical **profile photo** / **Heart** / **More** buttons on the right, playback progress, and **Mute**.
- It must **not** feel like a fixed HUD sitting on top of a video while only the video changes underneath.
- The **caught-up** row (06v) is a normal page in the same list and scrolls the same way.
- Users may **swipe to the next clip immediately** — no wait timer or Skip control. Minimum watch time (admin setting, default 3 seconds) applies **only** to whether a view counts for the poster; it does not gate navigation.
- On the **first** feed item only, **pull down from the top** reloads the feed from the server (same reload as after saving Feed Settings). If the user was browsing a **past day** from Browse Questions, pull-to-refresh also clears that choice and loads **today's** feed again. Pull-to-refresh does not apply on later items or on the caught-up page.
- Tapping the **Feed** tab while you are already on the Feed tab runs the same **today's feed** reload from the server (scrolls to the first item).
- **Captions** on 06 default to two lines with ellipsis inside a fixed-height box (48px on iOS; 58px on Android so both lines fit without clipping); tapping expands to show the full caption (tap again to collapse). Expanded layout: Pencil **06 Feed Caption Expanded**.
- **Playback:** The **play/pause** control to the left of the progress bar toggles playback. The icon shows **pause** while playing and **play** while paused. **Mute** stays on the right of the progress bar. Swiping to another clip while paused starts the new clip playing automatically.
- **Chrome visibility:** Tap the video (outside tappable chrome controls) to **hide** the overlay (top pill and actions, bottom metadata, progress row, and scrims). Tap the video again to **show** chrome. Hiding chrome does **not** pause playback. Swiping to another answer resets chrome to visible.

## What we must not do (anti-patterns)

- A **sibling overlay** drawn above the `FlatList` that stays fixed while the list scrolls underneath (breaks Android swipes and iOS reliability).
- **Full-screen `elevation` / high `zIndex`** on a transparent layer above the list (Android eats all gestures).
- **Separate scroll** for chrome vs video (e.g. video in a background layer and only metadata in the list, without the unified-page feel).

Each feed row mounts its own `VideoView` when near the active index; the **visible** experience must remain “one page scrolls as a unit.”

## How the app implements it (source of truth)

| Piece | Role |
|--------|------|
| `mobile/src/app/(tabs)/feed.tsx` | Paging `FlatList`; **one row height = measured feed area**; `FeedOverlay` (and end screen) **inside `renderItem`**, not as a sibling on top of the list. Full reloads bump a **load epoch** so in-flight pagination cannot append after settings save; pages merge with **dedupe by `answerId`**. Returning from Browse Questions **without** picking a day must **not** refetch the feed or reset the active clip: gate refresh skips reload when the list is already loaded for the current day and **viewability** (plus scroll offset on focus) keeps `activeIndex` aligned with the visible row. `decelerationRate="fast"` is **iOS only**. On Android that value sets fling friction about 7× the normal rate, so a short swipe dies and the next video does not become active until the finger has been dragged past halfway. Android keeps the platform default so a short flick advances one page, same as iPhone. |
| `mobile/src/components/FeedOverlay.tsx` | Chrome for a single answer; `pointerEvents="box-none"` on the root. Caption is tappable when truncated or expanded. Bottom block uses `BOTTOM_CHROME_OFFSET` (150 Android / 100 iOS) so chrome sits above the tab pill. Poster **name, age, and city** are one wrapping `Text` with a nested span for city (not sibling `Text` views in a row; Android truncates the name after the comma). |
| `mobile/src/app/answer/[answerId].tsx` | **06k** — same pager pattern: root `onLayout` **measured height** for row size (do not rely on `useWindowDimensions` alone on Android); `FlatList` with `StyleSheet.absoluteFill`; `AnswerDetailOverlay` inside each row. Bottom chrome is pinned with safe-area padding only (no tab-bar offset). |
| `mobile/src/components/FeedPageRow.tsx` | One **page** = `VideoView` + `FeedOverlay` in the same list row (unified scroll). Native players mount for the **active row ± 1**; `feedPlayerPool` reuses players across remounts. Playback URLs prefetch for **active + 2 ahead** and **1 behind**. |
| `mobile/src/lib/feedPlayerPool.ts` | Cached `VideoPlayer` per `answerId`; `pauseAllFeedPlayers` before stack navigation. Signed-in stack uses **`detachInactiveScreens: false`** so the feed tab stays mounted under Browse Questions / Feed Settings. |

**06k** uses the same bottom chrome pattern as **06** (name, collapsible caption, vertical profile photo / Heart / More, play/pause + progress + Mute), plus a **city · distance** row under the name. Tap-to-hide/show chrome matches **06**; **play/pause** is only on the progress row. Top chrome adds **back** instead of feed settings / search; the question label matches **06** (not tappable on **06k**). On your own answers (**06ka**) the heart is not rendered (`hideHeart`); the action strip is **More** only (no profile shortcut), with **Mute** on the progress row. More options opens the own-video sheet (**06kb**), not the feed menu.

Before merging any feed UI change, read the header comment in `feed.tsx` and confirm this table still holds.

## Verification (both platforms)

Run on **iPhone and Android** (Expo Go):

- **UAT B-05** — swipe between videos; pill updates when the day changes.
- **UAT B-05a** — pull down on the first feed item reloads the feed; later items do not.
- **UAT B-15** — unified page scroll (see `docs/UAT-flows.md`).

If touch handling changes, test **swipe in the middle of the screen** and **every feed control** on both OSes.
