# Feed vertical scroll (locked UX)

Mike approved this pattern in Phase B (Oct 2026). **Do not change it without an explicit product decision** and updates to this file, MVP requirements, UAT, and Pencil screen **06**.

## What the user experiences

- The feed is a **vertical, full-screen pager** (one answer per “page”).
- When they swipe up or down, **everything on that answer moves together**: the video, the top chrome (progress bar, question pill, settings), captions, name/age (with a **Following** badge to the right of the name when you follow that person), the city-and-distance row, and the bottom row (streak badge; more-options, heart, mute).
- It must **not** feel like a fixed HUD sitting on top of a video while only the video changes underneath.
- The **caught-up** row (06v) is a normal page in the same list and scrolls the same way.
- Users may **swipe to the next clip immediately** — no wait timer or Skip control. Minimum watch time (admin setting, default 3 seconds) applies **only** to whether a view counts for the poster; it does not gate navigation.
- On the **first** feed item only, **pull down from the top** reloads the feed from the server (same reload as after saving Feed Settings). If the user was browsing a **past day** from Browse Questions, pull-to-refresh also clears that choice and loads **today's** feed again. Pull-to-refresh does not apply on later items or on the caught-up page.
- Tapping the **Feed** tab while you are already on the Feed tab runs the same **today's feed** reload from the server (scrolls to the first item).

## What we must not do (anti-patterns)

- A **sibling overlay** drawn above the `FlatList` that stays fixed while the list scrolls underneath (breaks Android swipes and iOS reliability).
- **Full-screen `elevation` / high `zIndex`** on a transparent layer above the list (Android eats all gestures).
- **Separate scroll** for chrome vs video (e.g. video in a background layer and only metadata in the list, without the unified-page feel).

Playback may still use **one shared player** behind the list for performance; the **visible** experience must remain “one page scrolls as a unit.”

## How the app implements it (source of truth)

| Piece | Role |
|--------|------|
| `mobile/src/app/(tabs)/feed.tsx` | Paging `FlatList`; **one row height = measured feed area**; `FeedOverlay` (and end screen) **inside `renderItem`**, not as a sibling on top of the list. Full reloads bump a **load epoch** so in-flight pagination cannot append after settings save; pages merge with **dedupe by `answerId`**. |
| `mobile/src/components/FeedOverlay.tsx` | Chrome for a single answer; `pointerEvents="box-none"` on the root; caption area passes swipes through (`pointerEvents="none"` on the caption box). Bottom block uses `BOTTOM_CHROME_OFFSET` (150 Android / 100 iOS) so captions and action rail sit above the tab pill. |
| `mobile/src/app/answer/[answerId].tsx` | **06k** — same pager pattern: root `onLayout` **measured height** for row size (do not rely on `useWindowDimensions` alone on Android); `FlatList` with `StyleSheet.absoluteFill`; `AnswerDetailOverlay` inside each row. Bottom chrome is pinned with safe-area padding only (no tab-bar offset). |
| Shared `VideoView` | Sits **behind** the list; active row from viewability drives which clip plays. |

On your own answers (**06ka**) the same page layout applies; the only difference is that the heart is not rendered (`hideHeart`), so the bottom rail is more-options and mute. More options opens the own-video sheet (**06kb**), not the feed menu.

Before merging any feed UI change, read the header comment in `feed.tsx` and confirm this table still holds.

## Verification (both platforms)

Run on **iPhone and Android** (Expo Go):

- **UAT B-05** — swipe between videos; pill updates when the day changes.
- **UAT B-05a** — pull down on the first feed item reloads the feed; later items do not.
- **UAT B-15** — unified page scroll (see `docs/UAT-flows.md`).

If touch handling changes, test **swipe in the middle of the screen** and **every feed control** on both OSes.
