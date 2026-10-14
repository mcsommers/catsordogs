# Master test — Cats or Dogs? on staging

This is the ordered script for checking the whole product on the **staging** backend: several people posting, following, matching, chatting, and reporting, plus the feed order and the admin website. It is meant to be run by one person, on one phone, over two local days, with every email landing in **catsordogsapp@gmail.com**.

[UAT-flows.md](UAT-flows.md) is the screen-by-screen checklist (Welcome wording, caption states, photo zoom, and so on). This file does not repeat those. Use this file when the question is whether people, content, and the admin tools behave correctly together. Screen numbers (06, 07c, 08e) match `docs/pencil-new.pen`.

Tick a box when what you see matches the expected result. If it does not, note the ID (for example **M-24**) and what you saw instead.

## How the two days fit together

| When | What you prove |
| --- | --- |
| Day 1, setup | Admin access, the question calendar, and settings. Accounts exist but nobody has recorded yet. |
| Day 1, morning | The daily-question email goes to people who have not answered, and only to them. |
| Day 1, recordings | Eight people answer first, in an order that makes the feed predictable. Taylor and Parker record only after that check. |
| Day 1, afternoon | Feed order, filters, follows, match requests, chat, block, reports, and the review queue. |
| Day 2 (the next morning on your phone) | A nudge, a streak, a locked feed, yesterday rolling into the feed, and the "all caught up" screen. |

Do not start Day 2 until your phone's date has changed. The app uses the phone's calendar day, not UTC midnight. In October, midnight on the US East Coast is 4:00 AM UTC.

## Before you start

1. **Staging only.** `mobile/.env` must point at "Cats or Dogs - Staging". Nothing in this script should touch production. If you are unsure, ask the agent to confirm the URL in `mobile/.env` before anyone signs up.
2. **Start the phone app** with `cd mobile && npm run phone` (not `npm start`). Open confirmation links on that same phone so they reopen Expo Go.
3. **One inbox.** Every address below is a plus-address of `catsordogsapp@gmail.com`. Gmail delivers them all to that inbox, and staging treats each one as a different person. The plus sign goes on `catsordogsapp`, before the `@`, followed by that person's first name in lowercase. Example: `catsordogsapp+avery@gmail.com`.
4. **One password for every account.** Choose a password of at least 8 characters and use it everywhere. Keep it outside this file. The sign-in email is shown on Profile, just above **Log Out**, so you can see who is signed in.
5. **Log out between people.** Profile tab → **Log Out** → Welcome. Closing the app does not log you out.
6. **A second phone is optional.** It only helps for one check: a chat message appearing instantly while the other person already has the chat open. With one phone, send the message, log out, and log in as the other person.
7. **Email is how you judge notifications in this script.** Push to a real phone needs a development build. Expo Go will not reliably show remote pushes (on current Android it cannot). Each account turns **email on** for the types under test. A scheduled job sends queued email about once a minute. The daily-question job looks every 5 minutes, so that mail can arrive a few minutes late. A nudge is sent immediately. Settings has **Nudge notification delay** in minutes (default **0**). A number above 0 holds that one email so later nudges can be counted in it.
8. **Staging video (Mux test mode off).** Staging is set up with **`MUX_TEST_MODE=false`** in `supabase/functions/.env.staging` (and the same value in Supabase Edge Function secrets for staging). New uploads are **normal** Mux assets in the **Mux Staging** environment: **no** test watermark, up to the admin **recording length** (default **14** seconds), and they **stay** until deleted. They are **not** auto-removed after 24 hours. Mux bills encoding and storage on your plan. Record **one take** per person when you can; re-recording still counts against **recordings per day** (default **10**). If you see "We could not start the upload", ask the agent to check Mux and the staging `create-video-upload` function. "Recording limit reached" is the app's daily cap, not Mux. Do not run `supabase/seed-staging-feed.mjs` during this script. Extra demo posters would change who shows up in the feed.
9. **Write down today's question** when you first see it in the admin calendar (Part 3). Later steps call it "today's question".

If the feed shows a name that is not in the cast below, stop. Staging still has someone else's answer for today, and the order checks will not be trustworthy until that is cleared. Ask the agent before deleting anything.

## The cast

Create them in this order. Ages are as of October 2026. Use the birthday exactly so the age filter means something.

| Order | Email | First name | Birthday | Age | Gender | Location | What this person is for |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | catsordogsapp+avery@gmail.com | Avery | January 1, 1986 | 40 | Woman | Brooklyn, NY | Admin. Never records a video. |
| 2 | catsordogsapp+alex@gmail.com | Alex | March 15, 1998 | 28 | Woman | Brooklyn, NY | The person whose feed you judge. |
| 3 | catsordogsapp+jordan@gmail.com | Jordan | June 1, 1996 | 30 | Man | Brooklyn, NY | Should rank first for Alex. Match and chat. Day 2 nudge target. He does not record on Day 2. |
| 4 | catsordogsapp+sam@gmail.com | Sam | January 20, 1994 | 32 | Man | Austin, TX | Far away, little in common. Should rank behind Jordan, then disappear when distance is limited. |
| 5 | catsordogsapp+riley@gmail.com | Riley | August 8, 1999 | 27 | Woman | Brooklyn, NY | Followed by Alex, but outside "Show me: Men". Should still appear at the top. |
| 6 | catsordogsapp+morgan@gmail.com | Morgan | April 4, 1971 | 55 | Man | Brooklyn, NY | Followed by Alex, but outside age 25–40. Should be left out once the follow cap is full. |
| 7 | catsordogsapp+quinn@gmail.com | Quinn | February 2, 1997 | 29 | Man | Brooklyn, NY | Passes Alex's filters. Used for "wants to match" and a decline. |
| 8 | catsordogsapp+casey@gmail.com | Casey | March 1, 1993 | 33 | Man | Leave location empty | No city. Should vanish when a maximum distance is set. |
| 9 | catsordogsapp+drew@gmail.com | Drew | July 7, 1992 | 34 | Man | Brooklyn, NY | Second reporter. Follows Jordan on Day 1 so he can nudge him on Day 2. |
| 10 | catsordogsapp+taylor@gmail.com | Taylor | May 5, 1995 | 31 | Man | Brooklyn, NY | Stays out of the feed until after the filter check, then answers. |
| 11 | catsordogsapp+parker@gmail.com | Parker | September 9, 2000 | 26 | Man | Brooklyn, NY | Created so the account can be deleted. Records only at the end of Day 1. |

Shared profile choices, so ranking is explainable:

| Person | Interests (up to 5) | Relationship goal | What they say on camera |
| --- | --- | --- | --- |
| Alex | Hiking, Coffee, Cooking | Long-term relationship | Any short honest answer. Alex's own video never appears in Alex's feed. |
| Jordan | Hiking, Coffee | Long-term relationship | Read this, clearly, at a normal pace: "I walk my dog every morning before coffee, and I cook dinner at home most nights. I want something serious, and I care more about how someone treats people than about a perfect plan." |
| Sam | Movies | Short-term fun | Say only: "Yeah." |
| Riley | Hiking | Long-term relationship | One sentence about hiking. |
| Morgan | Movies | New friends | One short sentence. |
| Quinn | Travel, Yoga | Still figuring it out | One sentence. |
| Casey | Hiking | Long-term relationship | One sentence. Leave **Location** blank. |
| Drew | Online Games | Short-term fun | One sentence. |
| Taylor | Coffee | Long-term relationship | Do not record until Part 8 says so. |
| Parker | Hiking | Long-term relationship | Do not record until Part 12. |
| Avery | any one interest | any one goal | Do not record. |

One photo each is enough (Finish Setup needs a photo, a first name, a birthday, and a gender). Height, job, school, and About Me can stay empty except where a step says otherwise. Jordan's job title is **Designer**. Sam's job title is **Teacher**.

## Part 1 — Admin website pointed at staging

The admin site on your Mac is a separate small website. For this script it must talk to staging, the same project as the phone.

- [ ] **M-01 Point admin at staging.** In the `admin` folder, copy `.env.example` to `.env` if you do not already have one. Put the same staging project URL and anon key that are in `mobile/.env` into `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. From the project folder run `npm run admin` and open http://127.0.0.1:5173/admin/ . You should see **Admin sign in**, the line that there is no Create Account, and no Apple or Google buttons.

## Part 2 — Avery becomes an admin

- [ ] **M-02 Avery signs up.** On the phone: Get Started → email `catsordogsapp+avery@gmail.com` → your test password → Continue. Check Your Email (02d) names that address. Open the link on the phone. You land on Build Profile (03).
- [ ] **M-03 Avery's profile.** Add one photo. First name **Avery**. Birthday **January 1, 1986**. Gender **Woman**. Location **Brooklyn, NY** (pick the suggestion). Finish Setup. You reach How It Works (03b). Do **not** tap Record My First Answer. Log out.
- [ ] **M-04 A normal person cannot open admin.** On the admin site, sign in as Avery. Expected: you are signed straight back out, with "This tool is only for admins. An admin has to add you by hand in the database."
- [ ] **M-05 Add Avery to the admin list.** Ask the agent to add `catsordogsapp+avery@gmail.com` to `admin_users` on staging. Nobody can do this from the app or the website. Then sign in again as Avery. Expected: you land on the question calendar, the header says **Cats or Dogs? admin**, and your email is shown. The nav has Questions, Settings, Review queue, People, Videos, and Profile questions.

## Part 3 — Questions and settings, before anyone records

Stay signed in as Avery on the website.

- [ ] **M-06 Today and the next three days have questions.** On Questions, today is in the list and highlighted. Each of the next three days has question text of 1 to 200 characters. A day ahead with an empty box stays in the list and is highlighted. If a day is empty, type a question and save it. Write down the exact text of **today's** question. Previous questions, if any, are behind a separate past view and are newest first. That past view does not include today.
- [ ] **M-07 Today cannot be removed. A future day can.** Today has no working remove. Change today's text slightly (add " — master test" or similar), save, and confirm it is marked as an override. The phone will show the new text. Users never see the old wording. A future day can be removed and added again. Put the next three days back so they each have a question before you leave this page. Past questions cannot be edited or removed.
- [ ] **M-08 Write down settings, then park the daily email.** Open Settings. Write down every value, especially the Help & Support address (it may be empty). Confirm the defaults you are about to change away from, then set **only** this for now:
  - Daily Question Send Time: **23:59** (11:59 PM). This stops the "question is live" mail from going out while you are still creating accounts. You will move it in Part 5.
  - Leave everything else at the defaults: recording length **14**, minimum watch **3**, followed share **30**, flags to hide a video **5**, reporters before a profile is high priority **3**, feed look-back **7**, recordings per day **10**, nudge notification delay **0**, first recording **Today's question**, fixed question text **Cats or dogs?**.
  - Save. The page says **Saved.**

## Part 4 — Create the other profiles, still with no videos

For each person from Alex through Parker: Get Started, that person's plus-address, the shared password, open the confirmation link on the phone, fill Build Profile from the cast table, Finish Setup, stop on How It Works, log out. Do not record.

- [ ] **M-09 Ten more accounts.** Alex, Jordan, Sam, Riley, Morgan, Quinn, Casey, Drew, Taylor, and Parker all reach How It Works and then log out. Casey's Location is empty. Jordan's job title is Designer. Sam's job title is Teacher.
- [ ] **M-10 Under-18 is refused on the way.** On any one new Build Profile, pick a birthday that is under 18. As soon as the date is chosen, before Finish Setup, the birthday field turns red and the hint is "You must be 18 or older to join. Check your birthday." Put the real birthday back before you finish. (You can skip this if you already passed A-18 in UAT-flows.)
- [ ] **M-11 People list.** As Avery on the admin site, open People. Expected: a sortable table with thumbnail, first name, email, follower count, following count, matches, answers, join date, and last login. Open Alex. Expected: the full profile, including the photo. Follower and following are counts only. There is no list of who follows whom.

## Part 5 — Turn email on, then send today's question mail

The daily mail is skipped for anyone who has already answered, and it is also skipped if email is off and there is no working push. Do this **before** anyone records.

New sign-ups already have **email on** for all notification types. On **each** account from Avery through Parker: log in, open Profile → **Notifications** (08c), and confirm **email** (and **push**) are on for Daily question, Matches, Messages, and Nudges. If any account was created before that change, turn email on for the types that are still off. Log out. Opening the app also reports the phone's time zone, which the send time uses. Avery will not pass How It Works on later logins: a finished profile that has not answered today goes to Today's Question. Leave that screen with the back control or by logging out from Profile. Do not record.

- [ ] **M-12 Email toggles stick.** Log out of Alex and back in. Notifications still shows email on for Daily question, Matches, Messages, and Nudges.
- [ ] **M-13 Send the daily mail on purpose.** As Avery, set **Daily Question Send Time** to about **10 minutes from now** in your phone's time zone. Save. Wait up to 15 minutes (the job runs every 5 minutes). Expected in the Gmail inbox: one "Today's question is live" email per account that has not answered, and the body is today's question text. That includes Avery, Alex, and the rest. You should not get two copies for the same address.
- [ ] **M-14 Answering stops a repeat.** This is checked again at the end of Part 6. After Alex has submitted, set the time another 10 minutes ahead and wait. Alex does **not** get a second "Today's question is live" email. Avery, who still has not answered, can get another one. That is correct.

## Part 6 — Record today's answers, in this order

Record only the people in the list below, in this order, one take each. Say the line from the cast table. Wait on Review until captions finish, then Submit Answer. Do not re-record. Do not record Taylor, Parker, or Avery yet.

Order: **Sam, Morgan, Riley, Casey, Drew, Quinn, Alex, Jordan.** Jordan goes last so "posted more recently" also favors Jordan.

For each person the path is: log in → Today's Question (04) → tap to start → countdown 3, 2, 1 → the line → stop, or let it stop at the cap → Review (05) → Submit → Answer Submitted (05c) → log out.

Jordan must actually speak the long line. Sam must say only "Yeah."

- [ ] **M-15 Eight answers are live.** After Jordan submits, those eight people are done. Taylor, Parker, and Avery have still not recorded.
- [ ] **M-16 Alex is not asked to record again.** Log in as Alex. Expected: the app opens on the Feed, not Today's Question.
- [ ] **M-17 No second daily mail for Alex.** Do the check in M-14 now if you have not already.
- [ ] **M-18 Admin counts the answers.** As Avery, on Questions, today's row counts answers. A hidden video would still count; none are hidden yet. Open the video list for today. You see the eight recordings, not Taylor, Parker, or Avery. Watching one here does not tell that person, and it does not increase their view count. Note Jordan's view count on Jordan's own profile first if you want to confirm that: it should be unchanged after you watch as Avery.

## Part 7 — Alex's feed: order, filters, and the follow cap

Stay as Alex unless a step says otherwise. Alex has answered, so the Feed is unlocked (06).

- [ ] **M-19 Alex does not see herself.** Swipe the whole feed. Alex's own video is not in it. The other seven names can appear: Jordan, Sam, Riley, Morgan, Quinn, Casey, Drew. Taylor and Parker do not, because they have not answered.
- [ ] **M-20 Jordan ranks ahead of Sam.** With filters still cleared (no Show me chip selected, Age range empty, Maximum distance empty) and ranking still on the defaults, Jordan appears before Sam. Jordan is in Brooklyn, shares Hiking and Coffee, Dog lover, Non-smoker, and Long-term relationship, and gave a much longer answer. Sam is in Austin, shares none of that, and said "Yeah." You do not need a perfect order of all seven. Jordan-before-Sam is the check.
- [ ] **M-21 A view counts only after a real watch.** As Alex, let Jordan's clip play at least 3 seconds, then swipe away from Sam in the first second. Log in as Jordan. On Profile, that answer's eye count includes Alex (the count only, never Alex's name). Log in as Sam. Sam's eye count does not include that instant swipe. Log back in as Alex. Open Jordan's profile once, then open it again. As Jordan, the profile-view count went up by 1, not by 2, and it does not say who.
- [ ] **M-22 Follow three people.** As Alex, on Jordan's feed video tap **⋯**. The menu is Follow, Not Interested, Report, Block, Cancel. Follow. The dialog is "Follow Jordan?" and says he won't know you're following him, and that his answer will show up at the top of your feed every day he posts. Confirm **Yes, Follow**. Follow Riley and Morgan the same way. Their videos show an orange **Following** tag. As Jordan, the follower count on his own profile goes up, and the profile says identities stay private. Jordan is not told that Alex followed him. There is no email that names Alex.
- [ ] **M-23 Tighten the feed, then save.** As Alex, open Feed Settings (06i) from the settings control on the feed or from Profile. Set:
  - Show me: **Men**
  - Age range: min **25**, max **40**
  - Maximum distance: **50**
  - Leave the other filter chips on Any (none selected).
  - Leave ranking at Medium. Save. Expected: "Your feed settings were updated."
  Reopen the Feed and swipe from the top.
- [ ] **M-24 Follow cap and filter override.** With only those seven answers in today's pool, the followed share is 30 percent, rounded up. The feed should be:
  1. **Jordan**, with the Following tag (he passes the filters and is followed).
  2. **Riley**, with the Following tag. Riley is a woman, so "Show me: Men" would normally drop her. Following puts her in a top slot anyway.
  3. **Quinn** and **Drew**, in either order, with **no** Following tag. Both are men in Brooklyn inside the age range.
  - **Morgan is absent.** He is followed, but he is 55, so he fails the age filter, and he does not fit in the two top slots.
  - **Sam is absent** (Austin is farther than 50 miles, and Alex does not follow him).
  - **Casey is absent** (no city, and a maximum distance is set).
  - Alex, Taylor, Parker, and Avery are absent.
  If a stranger's name is in this list, the pool was not limited to the cast. Stop and ask the agent.
- [ ] **M-25 Clearing filters brings people back.** As Alex, clear Show me, clear both age boxes, clear Maximum distance, and save. Reopen the feed. Sam, Casey, and Morgan can appear again. Morgan still has the Following tag. Sam still appears after Jordan.
- [ ] **M-26 Unfollow.** On Morgan, **⋯** now says **Unfollow** instead of Follow. Confirm. The dialog says Morgan won't be notified, his answers will no longer show up at the top, and you won't be able to nudge him. After you confirm, Morgan's Following tag is gone. As Morgan, nothing tells him he was unfollowed. Alex still follows Jordan and Riley.

- [ ] **M-27 Drew follows Jordan.** Log in as Drew. On Jordan's video, **⋯** → **Follow** → **Yes, Follow**. Log out. This is what lets Drew nudge Jordan on Day 2. Drew's follow does not change the order checks you already did as Alex.
- [ ] **M-28 Morgan turns followers off.** Log in as Morgan. Profile → **Privacy & Safety** (08b). Turn **Allow followers** off. Log in as Alex and try to follow Morgan again. Expected: the follow does not stick, so Morgan does not get a Following tag. If the app shows an error, it says this person is not accepting followers. Log in as Morgan and turn **Allow followers** back on. Morgan's follower count never listed Alex by name. Log back in as Alex. Leave Morgan unfollowed.

## Part 8 — Taylor answers, and then shows up

Taylor has been absent on purpose. Someone who has not answered today cannot appear in today's feed, and you cannot nudge them until you already follow them from an earlier day. The nudge itself is Day 2, when Jordan has not answered the new day and Alex and Drew already follow him.

- [ ] **M-29 Taylor is missing, then appears.** As Alex, confirm Taylor is not in the feed. Log in as Taylor, record one sentence, submit, and log out. As Alex, pull the feed open again. Taylor is now in it. Alex's own video is still absent.

## Part 9 — Match requests, chat, mute, and unmatch

Do these as Alex unless a step says otherwise. Hearts sit to the right of **⋯**. A filled heart means a request is waiting or you are already matched. Tapping a filled heart asks you to cancel the request. It does not unmatch. Unmatch is inside the chat.

- [ ] **M-30 Send to Sam, then cancel.** On Sam's video, tap the heart. Expected: "Match with Sam?" and "Sam will be notified. You can chat only if you both match." Tap **Yes, Match**. The heart stays selected on Sam's videos and on Sam's profile. Open **Matches** → **Outgoing** (07e). The row shows Sam's name, age, and photo, the line "Waiting for a response · Sent …", **Cancel Request**, and **View Profile**. Cancel. Expected: "Cancel your request to Sam?" and "They won't know you sent one." Sam is not emailed about the cancel. The heart clears. Within a couple of minutes Sam gets at most one email, titled "New match request", body "Alex wants to match with you."
- [ ] **M-31 Like Jordan's answer, cancel, and like it again.** On Jordan's video, send a match the same way. Log in as Jordan. **Matches** → **Incoming** shows Alex, 28, her photo, a time, and "Liked your answer to …" using today's question text. Buttons: **Decline** and **View Profile**. Jordan's email is "New match request" / "Alex wants to match with you." Do not accept yet. As Alex, tap the selected heart and cancel. As Alex, send the request to Jordan again. Jordan's Incoming shows it again. Jordan does **not** get a second request email today. One request notification per sender, per recipient, per UTC day.
- [ ] **M-32 Jordan accepts.** As Jordan, Incoming → **View Profile** → **Accept** on Alex's profile (07h). Expected: you are matched and can open the chat. Both inboxes get a message titled "It's a match!". Jordan's says "You and Alex can chat now." Alex's says "You and Jordan can chat now." Declining is not this step. A decline does not email the sender. That is M-34.
- [ ] **M-33 Chat, mute, and report a message.** As Alex, **Matches** → **Chats** (07b). Jordan is listed with photo, last-message preview, and a relative time. Open the chat (07c). Expected: Jordan's photo, **Jordan, [age]**, and city/state in the header (not "Active now"). Send `Hello Jordan` and a wave emoji. The message stays within 1,000 characters. If you have a second phone already signed in as Jordan with the chat open, the message appears there without leaving the screen. Otherwise log in as Jordan and open the chat. The text is there. As Jordan, reply `Hi Alex`. As Alex, tap the flag in the chat header. Expected: "Report this message?" and "We'll review this message for violations of our community guidelines. Jordan won't be notified." Confirm **Report**. As Jordan, tap the bell. Expected: "Mute Alex?" and "You won't be notified about new messages from Alex until you turn this back on." Confirm **Mute**. As Alex, send `One more`. Jordan does not get a message email for that line. As Jordan, tap the bell again. Muting turns off with no second dialog. Leave the match in place until M-36.
- [ ] **M-34 Quinn: request from the profile, then decline.** As Alex, open Quinn's profile (not a video) and tap the heart. This confirmation is the profile one (07i), still "Match with Quinn?" and the line that Quinn will be notified and you can chat only if you both match. After it sends, the profile shows the request as sent (06z) and the heart is selected. As Quinn, Incoming says "Wants to match with you" (there is no question title, because Alex did not like a specific answer). Tap **Decline**. Expected: "Decline Alex's request?" and "They won't be notified." Confirm **Decline**. The row leaves Incoming. Alex is not emailed. As Alex, Outgoing no longer lists Quinn.
- [ ] **M-35 A match does not hide anyone.** As Alex, Jordan is still in the feed, still with the Following tag. Unmatching and matching do not remove a follow and do not hide someone from the feed.

- [ ] **M-36 Unmatch.** As Alex, open the chat with Jordan and tap the heart-with-a-slash (Unmatch). Expected: "Unmatch Jordan?" and "You'll lose this chat. Jordan won't be notified. You can match again later." Confirm **Unmatch**. The chat is gone for Alex. As Jordan, the chat is gone too, and Jordan was not emailed. Jordan is still in Alex's feed. Alex still follows Jordan. They can match again later. Do that only if you want to. The rest of the script does not need the match.

## Part 10 — Not Interested and block

- [ ] **M-37 Not Interested, without a follow.** As Alex, on Drew's video, **⋯** → **Not Interested**. Expected: "Hide Drew?" and "You won't see Drew in your feed anymore. They won't be notified." Button **Yes, Hide**. Confirm. Drew leaves Alex's feed. As Drew, Alex is still in the feed. Drew is not told. As Alex, Profile → **Blocked and Not Interested** (08e) → **Not Interested**. Drew is listed with name, age, and a date, and the button is **Undo**. Undo. No confirmation dialog. Drew can show in the feed again. A follow is not restored, because Alex was not following Drew.
- [ ] **M-38 Not Interested while following.** As Alex, follow Riley if you unfollowed her. Then **⋯** → **Not Interested**. Expected: the button is **Yes, Hide and Unfollow**, and the text says you will also unfollow them and they won't be notified. Confirm. Riley leaves the feed, and the follow is gone. Undo from the Not Interested tab. Riley can appear again. The follow does not come back. Follow Riley again so later checks are simple, or leave her unfollowed. Either is fine after this step. Alex must still follow Jordan.
- [ ] **M-39 Block Sam.** As Alex, on Sam, **⋯** → **Block**. Expected: "Block Sam?" and "You won't see each other again, and any match will be removed. You and Sam won't be able to message each other." Confirm **Block**. Sam disappears from Alex's feed. As Sam, Alex disappears from the feed, from Matches, and Sam is not told why. Sam cannot open Alex's profile. As Alex, **Blocked and Not Interested** → **Blocked**. Sam is listed with **Unblock**.
- [ ] **M-40 Unblock.** Tap **Unblock**. Expected: "Unblock Sam?" and the line that your old match won't come back and they won't be notified. Confirm. Sam can appear in the feed again. No match, chat, or follow is restored. As Sam, nothing announces the unblock.

## Part 11 — Reports, a hidden video, and the review queue

A flag hides one video, never the account. Profile reports and message reports wait for a person. They do not hide anything by themselves. Do this after the feed-order checks. Jordan's video has to be put back before you finish the day, or Day 2 cannot play it.

- [ ] **M-41 Lower the thresholds.** As Avery, on Settings, set "Flags that hide one video" to **2** and "Different people reporting a profile before it is high priority" to **2**. Save. Write down that you changed these.
- [ ] **M-42 Two people flag Jordan's video.** As Jordan, turn **email off** for every type on Notifications. The hidden-video notice is not allowed to respect that. As Alex, on Jordan's video, **⋯** → **Report**. Expected: "Report Jordan's answer?" and "We'll review this response for violations of our community guidelines. Jordan won't be notified." This is about the response, not the profile. Confirm. As Drew, report that same answer the same way. After the second distinct report, Jordan's video leaves other people's feeds. Jordan can still open the app, still open Matches and Profile, and still see that answer on his own profile with a **Hidden** label. The account is not disabled. Within a couple of minutes Jordan gets an email titled "Your answer was hidden", even with email toggles off. It names the question and points at Help & Support. It does not say who reported it.
- [ ] **M-43 The queue can put the video back.** As Avery, open **Review queue**. Filter to videos. Jordan's item is a **Hidden video**. **Review content** plays the video. That watch does not add a view and does not tell Jordan. Click **Put back**. The item leaves the queue. As Alex, Jordan's video is in the feed again. Do not click **Keep hidden**.
- [ ] **M-44 A profile report does not hide the profile.** As Alex, open Sam's profile and **⋯** → **Report**. Expected: "Report Sam?" and "We'll review this profile for violations of our community guidelines. Sam won't be notified." This wording is the profile one, not the video one. Confirm. As Drew, report Sam's profile the same way. As Avery, filter the queue to profiles. Sam's item shows **High priority** because two different people reported it and the setting is 2. **Review content** shows the profile, including the photo. **Mark reviewed**. The item leaves the queue. As Alex, Sam's profile and video are still available. Nothing was hidden automatically.
- [ ] **M-45 The message report is in the queue.** As Avery, filter the queue to chats. The message Alex reported in M-33 is there. **Review content** shows the conversation with that message marked. **Mark reviewed**. It leaves the queue.
- [ ] **M-46 Turn Jordan's email back on.** As Jordan, Notifications: email on again for Daily question, Messages, and Nudges. Matches email on. Day 2's nudge email will not arrive if this stays off.
- [ ] **M-47 Put the two thresholds back only after Part 12.** Leave them at 2 until Parker is deleted. Part 14 sets them back to 5 and 3 with everything else.

## Part 12 — Delete Parker

Parker exists so you can see an account disappear without destroying Alex or Jordan. Deleting the account should remove Parker's Mux files as well.

- [ ] **M-48 Parker records and is reported.** Log in as Parker, record one sentence, submit. As Drew, report Parker's profile (the profile report, from Parker's profile). As Alex, send Parker a match request from the feed. Parker's Incoming shows Alex.
- [ ] **M-49 Delete the account.** As Parker, Profile → **Privacy & Safety** → delete. Expected confirmation (08h): "Delete your account?" and "This permanently deletes your profile, photos, videos, chats, and matches. There is no undo." Confirm **Delete Account**. You are signed out. Trying to log in as Parker fails, or the account is simply gone.
- [ ] **M-50 Everyone else loses Parker immediately.** As Alex, Parker is gone from the feed and from Outgoing. As Avery, People no longer has a normal Parker row. The profile report can still be in the queue, with the name removed, so a review can see that a report happened. **Mark reviewed** if it is still waiting.

## Part 13 — The next local day

Wait until your phone's date has changed. With Mux test mode off, yesterday's clips **remain** on staging until someone deletes them, so Day 2 rollover and playback checks are not on a 24-hour clock.

Before anyone records on Day 2, ask the agent to trim staging **if the feed is noisy**: delete the Mux clips and the answer rows for every Day 1 answer **except Alex's and Jordan's**. Leave both accounts in place. Leave the follows in place (Alex follows Jordan, Drew follows Jordan). That optional cleanup keeps the feed predictable; it is no longer required to stay under an asset cap.

- [ ] **M-51 Day 2 question mail, before anyone answers.** As Avery, set **Daily Question Send Time** to about 10 minutes from now. Save. Wait up to 15 minutes. Alex, Jordan, Drew, and Avery each get one "Today's question is live" email with **today's** new question text. They had answered yesterday, which does not count for today.
- [ ] **M-52 Jordan skips and stays locked.** Log in as Jordan. Do not record. Tap "Skip today's question", then **Skip Anyway**. The Feed shows today's feed is locked (06m), shows today's question, and has **Answer Today's Question**. Matches and Profile still open. Jordan's streak still reads **1-day streak** (the days through yesterday, until he answers today). He is not going to answer today. Leave him skipped.
- [ ] **M-53 Drew answers today.** Drew records one sentence and submits. Leave Alex unanswered for the moment. Drew can now open the feed.
- [ ] **M-54 Watch is blocked while the feed is locked.** Jordan is still skipped, so his feed is locked. As Drew, on Jordan's video from yesterday, send a match request (**Yes, Match**). As Jordan, open **Matches** → **Incoming** → **View Profile**. The row says he liked Jordan's answer, and it names **yesterday's** question, because that is the clip Drew liked. The profile and the answer list are visible. Tap an answer. Expected: "Answer today's question to watch other people's videos." It does not fail silently. Decline the request so it does not linger. Then log in as Alex, record one sentence, and submit. Alex's streak now reads **2-day streak**. Jordan, still unanswered, still shows **1-day streak**.
- [ ] **M-55 Yesterday rolls in, with a banner.** As Alex, open the Feed. The first video is Drew's answer to **today's** question (Alex's own video is not shown). Swipe to the next day. The question pill changes to yesterday's date and yesterday's question. A banner reads **Earlier answers ·** and yesterday's month and day, with **Dismiss**. It goes away once you leave that first yesterday video, or when you tap Dismiss, and it does not come back for that day. Jordan's yesterday video is in that older day and still has the **Following** tag. The requirements doc describes this banner as "That's all of today. Showing yesterday, [date]". The app currently says "Earlier answers · [date]". Check the app's wording. If you want the doc and the app to use the same sentence, flag **M-55**.
- [ ] **M-56 Nudge Jordan, from two followers.** Jordan has not answered today. As Alex, open Jordan's profile from his video. A card says "Jordan hasn't answered today" and the button is **Nudge Jordan** (06n). Tap it. Expected: "Nudge Jordan?" and "He'll be told that a follower wants to hear his answer to today's question. He won't know who. You can nudge him once a day." Confirm **Yes, Nudge**. The button changes to **Nudged today** and does not send again. As Drew, open Jordan's profile and nudge once, the same way. Do both nudges. With the delay at **0**, Jordan's email goes out right after the first one, so nudge as Drew quickly if you want the count to include both. Jordan gets **one** email, not two. Title: "Your followers are waiting". Body: "2 followers want to hear your answer to today's question." if both nudges landed first, or "A follower wants to hear your answer to today's question." if the mail left after Alex only. Either body is a pass. It does not name Alex or Drew. Two named emails, or a mail that arrives after Jordan has answered, is a failure. Jordan has not answered, so the mail should arrive.
- [ ] **M-57 The card disappears only after he answers.** As Alex, Jordan's profile still shows the nudge card, now **Nudged today**, because skipping is not an answer. Do not have Jordan record (he is not meant to answer on Day 2).
- [ ] **M-58 Caught up.** As Alex, swipe until the feed ends. Expected: **You're all caught up**, then "You've seen every answer from the last 7 days that matches your filters. Check back tomorrow, or adjust your Feed Settings to see more people." Buttons: **Browse Past Questions** and **Adjust Feed Settings**. The "7" is the look-back setting. Adjust Feed Settings opens Feed Settings (06i).
- [ ] **M-59 Browse and search.** From the feed, tap the question pill (06c). Today's question is marked **Live now · Today's feed**. Yesterday is in the list with a response count of live answers only. Type a word from yesterday's question. The list narrows and the word is highlighted (06d). Clear the search and the full list returns. Pick yesterday. The feed shows that day. Close and reopen the feed. It starts at today again, not stuck on yesterday.
- [ ] **M-60 No second daily mail after answering.** As Avery, set the notification time another 10 minutes ahead. Alex, who has answered today, does not get another "Today's question is live" email. Jordan, who skipped and did not answer, can get one. That is correct.

## Part 14 — Put staging back, and the account screens

- [ ] **M-61 Edit Profile.** As Alex, Profile → **Edit Profile** (08d). Change About Me to `Master test note`. **Save Changes**. Profile shows the new text.
- [ ] **M-61b Discard profile edits (optional).** On **Edit Profile** or **Build Profile**, change a field, tap back, tap **Keep Editing**, then save or leave with **Leave Without Saving** as in **A-22b** / **D-31b**.
- [ ] **M-62 Ranking reset.** Feed Settings → set **Shared Interests** to High → save. Tap **Reset**. Every ranking signal (five) returns to Medium. Save if the screen asks you to.
- [ ] **M-63 Help & Support.** If the Help address is empty, Profile → **Help & Support** shows "Help is not set up yet. Check back later." As Avery, set Help & Support to `https://example.com` and save. As Alex, **Help & Support** opens that address in the browser. As Avery, put back the Help address you wrote down in M-08 (or clear it if it was empty).
- [ ] **M-64 Restore every setting.** As Avery, set Settings back to the values from M-08, except keep any Help address you just restored. In particular: recording length **14**, minimum watch **3**, followed share **30**, flags to hide a video **5**, profile high-priority count **3**, feed look-back **7**, recordings per day **10**, Daily Question Send Time **12:03**, nudge notification delay **0**, first recording **Today's question**, fixed question **Cats or dogs?**. Save.
- [ ] **M-65 Sign out of admin.** Sign out. The phone can stay on Alex. You are done with the main script.

## Extra checks

These are real product rules. They are separate because each one disturbs staging or adds another recording. Do them only if the main script passed, and put settings back afterward.

- [ ] **M-66 Fixed first question.** As Avery, set first recording to **A fixed question** and leave the text **Cats or dogs?**. Sign up `catsordogsapp+jamie@gmail.com` as Jamie, a new person, finish the profile, and open the recording screen. The question text is "Cats or dogs?", not today's calendar question. Submit. The answer still unlocks today's feed. Set first recording back to **Today's question**.
- [ ] **M-67 Unsubscribe.** Open any match email from this script and use the unsubscribe link. That type's email turns off for that account. A later email of that type does not arrive. Push for that type can stay on.
- [ ] **M-68 Missing tomorrow.** As Avery, remove tomorrow's question and leave it empty. Within about an hour, every admin (Avery) gets one email naming that next UTC day. Put the question back. If you add it before the mail goes out, the mail is dropped. Notification settings cannot turn this admin mail off.
- [ ] **M-69 Recording limit.** As Avery, set recordings per day to **2**. As a person who has not submitted today, start two recordings and leave both unsubmitted, then tap record a third time. Expected: "Recording limit reached" using the number 2, a single **Got It**, and no countdown. The feed stays locked. Set the limit back to **10**.
- [ ] **M-70 Both phones.** If you have an iPhone and an Android phone, repeat M-19, M-32, M-33, and M-55 on the other one. The screens, the words, and the order should match.

Screen-by-screen wording that this script does not walk through (Welcome, Apple and Google "Coming soon", caption editing, the photo grid, pinch-zoom) stays in [UAT-flows.md](UAT-flows.md). Run those when you care about a single screen rather than about several people over two days.
