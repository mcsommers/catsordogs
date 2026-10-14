# Feed rules — who appears, and in what order

The phone does not rank the feed. It calls the server function `get_feed` and shows the rows in the order that function returns. Filtering and ranking both happen in the database: `private.passes_filters` decides who is allowed, and `private.rank_score` scores the people who remain.

The score is mainly a comparison of **profiles**. One signal uses the video, and it only uses the caption as a word count. Nothing in the score looks at the picture, the audio, the length of the recording, or whether the words answer the question.

## What a row in the feed is

Each row is one **live answer**: one person, one question, one submitted video. The same person can appear again on an earlier day, once per answer. The viewer's own answers are never included.

`get_feed` returns nothing until the viewer's daily gate is open (they have a live or disabled answer for today in their own time zone).

## Who is removed before any filter or score

These checks run first. A person removed here does not come back by following them, and they are not scored.

| Rule | What the code checks |
| --- | --- |
| Not today's window | The question date is the viewer's local today, or a date inside the look-back window. The window is `today` back through `today - feed_lookback_days` from `app_settings` (default 7, allowed 0 to 90). Passing a specific date to `get_feed` shows that one day only, and only if it is today or earlier. |
| Not a finished profile | `profiles.profile_completed_at` must be set. |
| Not a live answer | `answers.status` must be `live`. `disabled` and `removed` are left out. |
| The viewer | `answers.user_id` must not be the viewer. |
| Block | A row in `blocks` in either direction. |
| Not Interested | A row in `not_interested` from the viewer to that person. This still applies when the viewer follows them. |

## Filters — who is allowed to appear

Filters are hard rules. They do not change the score. Each viewer's choices are one JSON object in `filter_preferences.filters`. A filter that is missing, or JSON `null`, is not applied. The list of filters is the `active` rows in `filter_definitions`. `passes_filters` walks that list.

Within one multi-select filter, a person passes if **any** chosen value appears on their profile (comparison is lowercased). Across filters, **every** active filter that the viewer set must pass.

| Filter key | Label in settings | Profile field | How it is applied |
| --- | --- | --- | --- |
| `show_me` | Show me | `profiles.gender` | `Women` keeps only gender `Woman`. `Men` keeps only gender `Man`. Any other saved value, including `Everyone`, removes nobody. `Non-binary` fails both `Women` and `Men`. |
| `age_range` | Age range | `profiles.birthday` | Age is `extract(year from age(current_date, birthday))`. Compared with the saved `min` and `max`. A bound that was not saved is not applied. A missing birthday fails the filter when the filter is set. |
| `max_distance` | Maximum distance | `profiles.latitude`, `profiles.longitude` on both people | Miles are the haversine distance with an Earth radius of 3958.8. If the **viewer** has no latitude, this filter is skipped. If the viewer has a location and this filter is set, a person with no coordinates fails, and a person farther than the saved number of miles fails. A distance equal to the number passes. |
| `height_range` | Height | `profiles.height_inches` | Same min/max rule as age. A missing height fails when the filter is set. The column is total inches (35 to 99). |
| `sexual_orientation` | Sexual orientation | `profiles.sexual_orientation` | Any overlap with the viewer's chosen values (fixed list from `profile_options`; no custom entries on the profile). |
| `occupation` | Occupation | `profiles.job_title` | The job title is one string. It passes when it equals one of the chosen values, ignoring case. |
| `smoking` | Smoking | `profiles.lifestyle_tags` | Any overlap with the chosen lifestyle tags. |
| `drinking` | Drinking | `profiles.lifestyle_tags` | A second filter on the same tags. If both smoking and drinking are set, the person must overlap each list. |
| `relationship_goals` | Relationship goals | `profiles.relationship_goal` | The profile stores one goal. It passes when that goal is one of the chosen values, ignoring case. |
| `interests` | Interests | `profiles.interests` | Any overlap with the chosen interests. Build / Edit Profile no longer edit this field (see below); new accounts usually have an empty array, so this filter only affects people with legacy or backfilled data until feed settings change. |

### Profile fields vs feed (Oct 2026)

- **`interested_in`** (Men, Women, Non-Binary on the profile) is **not** a filter and **not** a ranking signal. It does not appear in `passes_filters` or `rank_score`.
- **`interests`** (hobby tags on `profiles.interests`) is still what the **Interests** filter and **Shared interests** ranking use. The app replaced hobby **Interests** on Build / Edit Profile with **Interested in**; the `interests` column remains for old rows. Do not confuse the two names.

These profile fields are also not filters and not ranking signals: first name, school, about me, profile photos (avatar and gallery), **`interested_in`**, **`languages`** and **`pronouns`** (legacy columns, not edited in the app), and the allow-followers switch.

Followed people are exempt from this section, up to the cap described below. Block, Not Interested, a hidden video, and an unfinished profile are not exempt.

## Ranking — the order of people who passed

`rank_score` is a weighted average of six signals. Each signal is a number from 0 to 1. Each has a viewer setting of Low, Medium, or High, stored on `feed_settings`. Those words become weights:

| Setting | Weight |
| --- | --- |
| Low | 1 |
| Medium | 2 |
| High | 3 |

Every column defaults to Medium. Reset sets all six back to Medium.

The score is:

```
(w1*s1 + w2*s2 + w3*s3 + w4*s4 + w5*s5 + w6*s6) / (w1 + w2 + w3 + w4 + w5 + w6)
```

Raising one weight also shrinks the share of the other five, because they all divide by the same total. With every signal at Medium, each one is 2/12 of the score.

### The six signals

**1. Shared interests** (`feed_settings.shared_interests`)

Fields: `profiles.interests` on the viewer and on the other person (hobby tags, **not** `interested_in`).

Score = (how many of the **viewer's** interests also appear on the other person) / (how many interests the viewer has), capped at 1. Extra interests that only the other person has do not help. If the viewer has none, the score is 0. Because new profiles no longer fill `interests`, this signal is often 0 for everyone until feed settings or the server are updated.

**2. Relationship goals** (`feed_settings.relationship_goals`)

Field: `profiles.relationship_goal` on each person. This is an exact match, and it is case-sensitive.

| Situation | Score |
| --- | --- |
| Either person has no goal | 0.5 |
| The goals are the same text | 1 |
| The goals differ | 0 |

**3. Response depth** (`feed_settings.response_depth`)

Field: `answers.caption_text`.

That text is saved when the answer is submitted. It is the caption segments' `text` values, trimmed and joined with spaces, in order. Edits made before submit are what get stored. The score does not use the timed `videos.caption_segments` after that, and it does not compare the words to the question.

Score = min(1, word count / 40). Words are split on whitespace. An empty caption scores 0. A caption of 40 or more words scores 1.

**4. Lifestyle compatibility** (`feed_settings.lifestyle_compatibility`)

Field: `profiles.lifestyle_tags` on the viewer and on the other person.

Same overlap rule as interests: the share of the **viewer's** tags that the other person also has. If the viewer has none, the score is 0.

**5. Distance** (`feed_settings.distance`)

Fields: `profiles.latitude` and `profiles.longitude` on both people. The miles are the same haversine used by the distance filter.

| Situation | Score |
| --- | --- |
| Either person has no coordinates | 0.5 |
| 0 miles | 1 |
| 50 miles | 0.5 |
| 100 miles or more | 0 |

The formula is `max(0, 1 - miles / 100)`.

**6. Recency** (`feed_settings.recency`)

Fields: `answers.submitted_at`, and the question's `questions.question_date`.

Score = the fraction of the UTC day between midnight UTC on the question date and the submit time, clamped to 0–1. A submit at UTC midnight scores 0. A submit 24 hours later, or any later, scores 1. This is not the viewer's local midnight, and it is not "who is closer to the top of the feed."

### Video fields that do not affect the score

`get_feed` also reads `answers.duration_seconds` and `videos.caption_segments`, and it returns them to the phone. They are not passed into `rank_score` or `passes_filters`. Recording length, watch time, view count, and streak are not inputs either. Streak and match state are attached to each row **after** the order is chosen.

## Followed people, and the cap

After the exclusions above, a row is kept for scoring if the viewer follows that person **or** the person passed the filters.

For each question date, the server counts those kept rows (`day_total`). The number of followed slots is

```
ceil(day_total * followed_content_cap_percent / 100)
```

`followed_content_cap_percent` is one admin setting for the whole app (default 30, allowed 0 to 100). The count is rounded up.

Followed rows are ordered by the same six-signal score. The ones inside the slot count are marked as top slots. They stay in the feed even when they fail the viewer's filters. Followed rows past the slot count stay only if they pass the filters. Otherwise they are dropped.

A followed person who fails the filters still counts toward `day_total`, which can make the slot count larger.

## The order the phone receives

1. Newer question date first. The feed therefore starts with the viewer's local today, then the previous day, and so on, until the look-back limit.
2. Within a day, top-slot followed answers first.
3. Then the six-signal score, highest first.
4. If the score ties, the answer id, descending.

Opening the feed with no date always starts from today again. Choosing a past question (`p_date`) returns that day only, with the same filters, score, and follow cap.
