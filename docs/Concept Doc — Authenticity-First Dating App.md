# Concept Doc — Authenticity-First Dating App

Sep 27, 2026 · @Mike

## The Problem

Today's dating apps have an authenticity problem, and it traces back to three converging failure patterns documented in user reviews: paywalled core features (31% of all negative reviews across major apps — basic functions like seeing who liked you are locked behind $30+/month subscriptions), fake profiles, bots, and scammers (21% of complaints — profiles that aren't real people, or real people using stolen or outdated photos), and poor match quality (17% — swipe-based apps are optimized for engagement, not compatibility).

Static photos and text bios are trivially easy to fake, curate, or misrepresent. And even where apps have added one-time identity verification, nothing stops a verified real person from misrepresenting who they are day to day.

## The Solution

Each day, every user gets the same question — some tied to current events, some evergreen and "universal" in nature (e.g., "what are your thoughts on graffiti?"). To see anyone else's response that day (the Feed), a user must first record their own answer on camera, capped at 14 seconds. Users can choose to skip the question, but then the Feed stays locked until they answer; Matches, chats, and their own Profile remain available. The 14-second cap is an admin-set default.

New users start with the same question everyone else is answering that day, so their first recording is also what unlocks the feed — they land in a full feed of today's responses right away. After sign-up and profile setup, a short "How it works" screen explains the mechanic, and the first recording follows. Every response is saved to the user's profile until they delete their account, building a growing video archive that shows not just what someone looks like, but how they think and communicate over time.

Viewers can skip a video before it finishes (after a minimum watch time) the same way they'd skip a photo, keeping browsing fast even though the underlying content is video, not a static image. If a day's supply of matching videos runs out, the feed continues into earlier days (up to an admin-set number of days, default 7) before showing an "all caught up" screen. Users can follow people so their answers appear at the top of the feed; the person followed is never told.

## Why This Is Defensible

Most "authenticity" efforts in dating apps today center on one-time identity verification — ID checks, live selfie liveness checks, social-account cross-referencing. These confirm a person is real at signup, but they don't stop a real person from posting old or misleading photos afterward, and they add no ongoing cost to maintaining a fake or misleading presence once verified.

This concept flips the model: authenticity is enforced continuously, not at a single gate. The question itself does become public the moment early responders see it each day, so it isn't guaranteed to be a secret — someone could hear it from a friend and think through an answer before recording. What the mechanic actually defends is narrower but still real: whatever the question, a real, distinct person still has to appear on camera, live, as themselves, every day. That's a fundamentally higher and more sustained cost to fake than uploading a stolen or AI-generated photo once, rehearsal or not. The archive compounds this advantage: a single video proves a person is real; a year of videos proves consistency, personality, and how someone actually communicates — something stolen photos or generated content can't easily replicate at scale.

## Target Audience & Positioning

This mechanic filters on two axes: willingness to be recorded on camera daily, and seriousness about actually finding a relationship rather than casually browsing. That's an intentional trade — it skews toward a narrower, more video-comfortable audience, and away from people who are serious but camera-shy, or whose circumstances make daily on-camera participation impractical.

**Recommendation: launch narrow, not broad.** Dating apps live on local match density, so a broad, general-purpose trust platform is the right long-term ambition but the wrong day-one go-to-market — a thin presence across many markets fails before the mechanic has a chance to prove itself. Pick one city or one audience segment where the authenticity problem is acutely felt (e.g., people who've been burned by scams or catfishing before) as the initial wedge, prove behavior change and retention there, then expand.

## Retention Philosophy

BeReal, the closest reference point for this mechanic, grew from roughly 21.6M to 73.5M users in a single month in 2022, then declined to about 23M by early 2024 — largely because the daily cost of posting was certain and immediate, while the payoff (staying connected with friends) was diffuse and easy to take for granted.

A dating app carries the same structural risk: most days produce no visible outcome (no match, no message), even though the eventual goal is worth far more than a photo streak. To avoid the same decline, the daily habit needs its own immediate reward, independent of whether a match happens that day — visibility into how many people watched a given response and viewed their profile, a sense of how it landed, and a public streak of consecutive days answered. The permanent video archive also reframes each day's answer as a long-term investment in a richer profile, not a one-time post that's forgotten by tomorrow.

## Open Risks

- **Moderation load.** Video review at daily, per-user scale is a materially larger moderation surface than photo-based apps. Plan for per-video (not per-account) flag-and-review, a flag-weighting or appeals mechanism to guard against brigading, and proactive detection for the most severe content categories rather than relying on flags alone.
- **Biometric and privacy law exposure.** Storing facial video indefinitely, and using it for any AI-driven ranking, touches biometric privacy law in many jurisdictions (e.g., Illinois BIPA, GDPR special-category data), which typically requires explicit consent and gives users deletion rights. Needs legal review before launch, not after.
- **Appearance-first skipping.** Making videos skippable, to preserve fast browsing, risks recreating the same looks-first judgment that static-photo apps are criticized for, and may push users to perform for the first frame the way people already curate photos. Captions and a minimum watch time before skip help, but this is an ongoing design tension, not a solved problem.
- **Prompt leakage.** Because the same question goes live for everyone, someone who hasn't opened the app yet that day can hear the question from a friend or social media and think through an answer before recording. The defense this mechanic offers isn't a secret question — it's that a real person still has to appear on camera, live, every day, regardless of how much notice they had.
- **Every daily question doubles as a first-ever question.** Because new users start with the day's question rather than a fixed easy one, a heavy or divisive prompt lands on someone who has never recorded a video on the app. This needs editorial discipline in the question calendar, since the first-recording experience is now only as gentle as the day's question.
- **Camera-shyness filters out real, serious users too**, not just bots or low-effort accounts — worth deciding deliberately how much of that trade-off is acceptable.
