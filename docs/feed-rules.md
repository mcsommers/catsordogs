# Feed rules — who appears, and in what order

The phone does not rank the feed. It calls the server function `get_feed` and shows the rows in the order that function returns. Filtering and ranking both happen in the database: `private.passes_filters` decides who is allowed, and `private.rank_score` scores the people who remain.

The score is a comparison of **profiles** only. Nothing in it looks at the video, the picture, the audio, the caption words, the length of the recording, or whether the words answer the question.

## What a row in the feed is

Each row is one **live answer**: one person, one question, one submitted video. The same person can appear again on an earlier day, once per answer. The viewer's own answers are never included.

`get_feed` returns nothing until the viewer's daily gate is open (they have a live or disabled answer for today in their own time zone).

## Who is removed before any filter or score

These checks run first. A person removed here does not come back by following them, and they are not scored.


| Rule                   | What the code checks                                                                                                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not today's window     | The question date is the viewer's local today, or a date inside the look-back window. The window is `today` back through `today - feed_lookback_days` from `app_settings` (default 7, allowed 0 to 90). Passing a specific date to `get_feed` shows that one day only, and only if it is today or earlier. |
| Not a finished profile | `profiles.profile_completed_at` must be set.                                                                                                                                                                                                                                                               |
| Not a live answer      | `answers.status` must be `live`. `disabled` and `removed` are left out.                                                                                                                                                                                                                                    |
| The viewer             | `answers.user_id` must not be the viewer.                                                                                                                                                                                                                                                                  |
| Block                  | A row in `blocks` in either direction.                                                                                                                                                                                                                                                                     |
| Not Interested         | A row in `not_interested` from the viewer to that person. This still applies when the viewer follows them.                                                                                                                                                                                                 |




## Filters — who is allowed to appear

Filters are hard rules. They do not change the score. Each viewer's choices are one JSON object in `filter_preferences.filters`. A filter that is missing, or JSON `null`, is not applied. The list of filters is the `active` rows in `filter_definitions`. `passes_filters` walks that list.

Within one multi-select filter, a person passes if **any** chosen value appears on their profile (comparison is lowercased). Across filters, **every** active filter that the viewer set must pass.


| Filter key           | Label in settings  | Profile field                 | How it is applied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show_me`            | Show me            | `profiles.gender`             | `Women` keeps only gender `Woman`. `Men` keeps only gender `Man`. Any other saved value, including `Everyone`, removes nobody. Every gender chosen from the **More** list on Build/Edit Profile (for example `Non-binary`, `Trans Woman`, `Two-Spirit`) fails both `Women` and `Men`. The gender is used here even when the person turns **Show gender on my profile** off; that switch only controls whether other people can see it.                                                                                                                      |
| `age_range`          | Age range          | `profiles.birthday`           | Two-handle slider, 18 to 70+. Age is `extract(year from age(current_date, birthday))`. Compared with the saved `min` and `max`. A handle on its end has no limit on that side: a saved max of 70 means 70 and older (a 75-year-old passes), and a saved min of 18 has no lower limit. Both handles on the ends is the same as Any (the filter is not saved). A missing birthday fails the filter when it is set.                                                                                                                                            |
| `height_range`       | Height             | `profiles.height_inches`      | Two-handle slider, 2'0" (24 in) to 7'0"+ (84 in), same end-handle rule as age. A missing height fails when the filter is set, but not when both handles are on the ends. The column is total inches (35 to 99).                                                                                                                                                                                                                                                                                                                                             |
| `sexual_orientation` | Sexual orientation | `profiles.sexual_orientation` | Each profile now holds at most one orientation (single-select on Build/Edit Profile). The viewer can still pick several values in Feed Settings; a person passes if their one value is among them. Lesbian is not linked to Show me or Interested in. (fixed list from `profile_options`: Straight, Gay, Lesbian, Bisexual, Asexual, Demisexual, Pansexual, Queer, Questioning; no custom entries on the profile). A person who turned **Show orientation on my profile** off is still compared; that switch only controls whether other people can see it. |




### Profile fields vs feed (Oct 2026)

- `interested_in` (Men, Women, Non-Binary on the profile) is **not** a filter and **not** a ranking signal. It does not appear in `passes_filters` or `rank_score`.
- **There is no Occupation filter (Oct 2026).** Job title is not used for filtering or ranking.
- **Filter order on Feed Settings:** Show me, Sexual orientation, Age range, Height.
- **There is no Relationship goals filter (Oct 2026).** Relationship goals only affect the order, through the Relationship Goals ranking signal.
- **There is no Maximum distance filter (Oct 2026).** Distance only affects the order, through the Distance ranking signal. People with no location are never filtered out for it.
- **There is no Interests filter (Oct 2026).** Interests only affect ranking (Shared Interests, below). `interests` (up to 5 picks on `profiles.interests`, chosen on screen 03e) is what the **Shared interests** ranking uses. These picks replaced the older hobby list in the same column. Do not confuse it with **Interested in**.
- **Lifestyle tags, Smoking, Drinking, and Lifestyle compatibility were removed (Oct 2026).** The `smoking` and `drinking` filters are inactive, and the old `lifestyle_tags` column is emptied and no longer edited.
- **Response depth and Recency were removed from ranking (Oct 2026).** Ranking has three signals: Shared interests, Relationship goals, and Distance. How long or detailed an answer is, and what time of day it was posted, do not affect the order.

These profile fields are also not filters and not ranking signals: first name, school, about me, profile photos (avatar and gallery), `interested_in`, `languages`, `pronouns`, and `lifestyle_tags` (legacy columns, not edited in the app), and the **Show gender / Show orientation on my profile** switches (they only hide the value from other people's view), and the allow-followers switch.

Followed people are exempt from this section, up to the cap described below. Block, Not Interested, a hidden video, and an unfinished profile are not exempt.

## Ranking — the order of people who passed

`rank_score` is a weighted average of three signals. Each signal is a number from 0 to 1. Each has a viewer setting of Low, Medium, or High, stored on `feed_settings`. Those words become weights:


| Setting | Weight |
| ------- | ------ |
| Low     | 1      |
| Medium  | 2      |
| High    | 3      |


Every column defaults to Medium. Reset sets all three back to Medium.

The score is:

```
(w1*s1 + w2*s2 + w3*s3) / (w1 + w2 + w3)
```

Raising one weight also shrinks the share of the other two, because they all divide by the same total. With every signal at Medium, each one is 2/6 of the score.

### The three signals

**1. Shared interests** (`feed_settings.shared_interests`)

Fields: `profiles.interests` on the viewer and on the other person (the up-to-5 Interests picks, **not** `interested_in`).

Score = (how many of the **viewer's** interests also appear on the other person) / (how many interests the viewer has), capped at 1. Extra interests that only the other person has do not help. If the viewer has none, the score is 0. A viewer who picked no Interests scores 0 with everyone.

**Specific option (4th choice, Oct 2026).** Shared Interests offers **Low / Medium / High / Specific**. Low, Medium and High weigh 1, 2 and 3 and score on the viewer's own profile interests, as above. **Specific** (`feed_settings.shared_interests = 'specific'`) scores on the interests the viewer picked on screen 06ia (`feed_settings.specific_interests`, any number, no limit) instead, and weighs **6** (double High), because the viewer is saying exactly which interests matter.

- Score = (how many of the viewer's specific picks also appear on the other person) / (the smaller of the number picked and 3), capped at 1. So matching any 3 of the picks is a full score, however many were picked; a person who has none of them scores 0.
- Specific with nothing picked is not kept: the setting goes back to what it was before Specific was chosen (Medium if it was already Specific and every pick was cleared). The server enforces this.
- The picks are kept when the viewer switches back to Low / Medium / High, and are cleared by **Reset**.

**2. Relationship goals** (`feed_settings.relationship_goals`)

Field: `profiles.relationship_goal` on each person. This is an exact match, and it is case-sensitive.


| Situation                   | Score |
| --------------------------- | ----- |
| Either person has no goal   | 0.5   |
| The goals are the same text | 1     |
| The goals differ            | 0     |


**3. Distance** (`feed_settings.distance`)

Fields: `profiles.latitude` and `profiles.longitude` on both people. The miles are the same haversine used by the distance filter.


| Situation                        | Score |
| -------------------------------- | ----- |
| Either person has no coordinates | 0.5   |
| 0 miles                          | 1     |
| 50 miles                         | 0.5   |
| 100 miles or more                | 0     |


The formula is `max(0, 1 - miles / 100)`.

### Video fields that do not affect the score

`get_feed` also reads `answers.duration_seconds`, `answers.caption_text`, `answers.submitted_at`, and `videos.caption_segments`, and it returns them to the phone. They are not passed into `rank_score` or `passes_filters`. Recording length, watch time, view count, and streak are not inputs either. Streak and match state are attached to each row **after** the order is chosen.

## Followed people, and the cap

After the exclusions above, a row is kept for scoring if the viewer follows that person **or** the person passed the filters.

For each question date, the server counts those kept rows (`day_total`). The number of followed slots is

```
ceil(day_total * followed_content_cap_percent / 100)
```

`followed_content_cap_percent` is one admin setting for the whole app (default 30, allowed 0 to 100). The count is rounded up.

Followed rows are ordered by the same three-signal score. The ones inside the slot count are marked as top slots. They stay in the feed even when they fail the viewer's filters. Followed rows past the slot count stay only if they pass the filters. Otherwise they are dropped.

A followed person who fails the filters still counts toward `day_total`, which can make the slot count larger.

## The order the phone receives

1. Newer question date first. The feed therefore starts with the viewer's local today, then the previous day, and so on, until the look-back limit.
2. Within a day, top-slot followed answers first.
3. Then the three-signal score, highest first.
4. If the score ties, the answer id, descending.

Opening the feed with no date always starts from today again. Choosing a past question (`p_date`) returns that day only, with the same filters, score, and follow cap.