import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Briefcase,
  Calendar,
  EllipsisVertical,
  Flame,
  GraduationCap,
  Heart,
  MapPin,
  Ruler,
  Target,
  Users,
} from 'lucide-react-native';
import {
  fetchUserAnswersPage,
  fetchUserProfile,
  PROFILE_ANSWER_PAGE_SIZE,
  recordProfileView,
  type ProfileAnswer,
  type UserProfile,
} from '../../lib/profile';
import {
  formatHeightFeetInches,
  formatJoinedMonthYear,
  formatJoinedShort,
  formatProfileLocation,
  formatStreakBadge,
  formatVisibleProfileIdentity,
} from '../../lib/format';
import { BackButton, CenteredSpinner, ErrorBanner, TextLink } from '../ui';
import { colors, fonts } from '../../theme';
import { ProfileAccountSection } from './ProfileAccountSection';
import { ProfileAnswerPreviewThumb } from './ProfileAnswerPreviewThumb';
import { ProfileArchiveCard } from './ProfileArchiveCard';
import { ProfileHeroIconButton } from './ProfileHeroIconButton';
import { ProfileInfoChip } from './ProfileInfoChip';
import { pickAndAddGalleryPhoto } from '../../lib/addGalleryPhoto';
import { avatarPhoto } from '../../lib/profilePhotos';
import { FollowingBadge } from '../FollowingBadge';
import { ProfilePhotoGrid } from './ProfilePhotoGrid';
import { ProfileStatBadge } from './ProfileStatBadge';
import { ProfileTagChip } from './ProfileTagChip';
import { HERO_HEIGHT_OTHER, HERO_HEIGHT_SELF, PROFILE_PAD, PROFILE_SCROLL_BOTTOM } from './profileLayout';
import { profileType } from './profileTypography';
import { signOutToWelcome } from '../../lib/signOut';
import { supabase } from '../../lib/supabase';
import {
  acceptMatchRequest,
  declineMatchRequest,
  getFollowState,
  getIncomingMatchRequests,
  nudgeUser,
  type IncomingMatchRequest,
} from '../../lib/social';
import type { FeedMatchState } from '../../lib/feed';
import { MoreOptionsMenu } from '../social/MoreOptionsMenu';
import { IncomingMatchCard } from '../social/IncomingMatchCard';
import { MatchRequestSentBanner } from '../social/MatchRequestSentBanner';
import { NudgeCard } from '../social/NudgeCard';
import { confirmAcceptMatch, confirmDeclineMatch, confirmNudge } from '../social/confirmations';
import { useSocialActions, type SocialSubject } from '../social/useSocialActions';
import { formatRelativeTime } from '../../lib/format';

const PREVIEW_COUNT = 3;

function ProfileHeroName({
  profile,
  showFollowing,
}: {
  profile: UserProfile;
  showFollowing: boolean;
}) {
  const identity = formatVisibleProfileIdentity(
    profile.sexualOrientation,
    profile.gender,
    profile.showOrientation,
    profile.showGender
  );
  return (
    <View style={styles.heroNameRow}>
      <View style={styles.heroNameIdentity}>
        <Text style={styles.heroName}>
          {profile.firstName.trim().toUpperCase()}
          {profile.age != null ? `, ${profile.age}` : ''}
        </Text>
        {identity ? <Text style={styles.heroIdentity}>({identity})</Text> : null}
      </View>
      {showFollowing ? <FollowingBadge /> : null}
    </View>
  );
}

type Props = {
  userId?: string | null;
  showBack?: boolean;
};

export function ProfileView({ userId, showBack }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [answers, setAnswers] = useState<ProfileAnswer[]>([]);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [canNudge, setCanNudge] = useState(false);
  const [alreadyNudged, setAlreadyNudged] = useState(false);
  const [matchState, setMatchState] = useState<FeedMatchState>('none');
  const [incomingRequest, setIncomingRequest] = useState<IncomingMatchRequest | null>(null);
  const [matchSentBanner, setMatchSentBanner] = useState(false);
  const [galleryPhotoBusy, setGalleryPhotoBusy] = useState(false);
  const [galleryPhotoBanner, setGalleryPhotoBanner] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const loadProfile = useCallback(async (opts?: { silent?: boolean }) => {
    setFailed(false);
    if (!opts?.silent) setLoading(true);
    try {
      const p = await fetchUserProfile(userId ?? null);
      if (!p) {
        setProfile(null);
        return;
      }
      setProfile(p);
      setMatchState((p.matchState as FeedMatchState) || 'none');
      setMatchSentBanner(false);
      setIncomingRequest(null);
      if (!p.isSelf) {
        await recordProfileView(p.userId);
        const fs = await getFollowState(p.userId);
        setIsFollowed(fs.following);
        setCanNudge(fs.canNudge);
        setAlreadyNudged(fs.alreadyNudged);
        if (p.matchState === 'incoming') {
          const incoming = await getIncomingMatchRequests();
          setIncomingRequest(incoming.find((row) => row.userId === p.userId) ?? null);
        }
      }
      const page = await fetchUserAnswersPage(userId ?? null, 0, PROFILE_ANSWER_PAGE_SIZE);
      setAnswers(page.items);
      setTotalAnswers(page.totalCount);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile({ silent: loadedOnceRef.current });
    }, [loadProfile])
  );

  const loadMoreAnswers = useCallback(async () => {
    if (loadingMoreRef.current || answers.length >= totalAnswers) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchUserAnswersPage(userId ?? null, answers.length, PROFILE_ANSWER_PAGE_SIZE);
      setAnswers((prev) => [...prev, ...page.items]);
      setTotalAnswers(page.totalCount);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [answers.length, totalAnswers, userId]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 120) loadMoreAnswers();
  };

  const openPhotos = (displayIndex: number) => {
    if (!profile) return;
    router.push({ pathname: '/user/[id]/photos', params: { id: profile.userId, start: String(displayIndex) } });
  };

  const onAddGalleryPhoto = useCallback(async () => {
    if (!profile?.isSelf || galleryPhotoBusy) return;
    setGalleryPhotoBanner(null);
    setGalleryPhotoBusy(true);
    try {
      const result = await pickAndAddGalleryPhoto(profile.userId, profile.photos);
      if (result.ok) {
        setProfile((p) => (p ? { ...p, photos: result.photos } : p));
      } else if (!result.canceled) {
        setGalleryPhotoBanner(result.banner);
      }
    } finally {
      setGalleryPhotoBusy(false);
    }
  }, [profile, galleryPhotoBusy]);

  const socialSubject: SocialSubject | null =
    profile && !profile.isSelf
      ? {
          userId: profile.userId,
          firstName: profile.firstName,
          gender: profile.gender,
          avatarUri: avatarPhoto(profile.photos)?.url,
          isFollowed,
          matchState,
          surface: 'profile',
        }
      : null;

  const social = useSocialActions(socialSubject, {
    onStateChange: (patch) => {
      if (patch.isFollowed != null) setIsFollowed(patch.isFollowed);
      if (patch.matchState != null) setMatchState(patch.matchState);
    },
    onMatchSent: (result) => {
      if (result === 'sent') setMatchSentBanner(true);
    },
    onBlocked: () => router.back(),
    onNotInterested: () => router.back(),
  });

  const heartOn = matchState === 'sent' || matchState === 'matched';

  const openAnswer = (answer: ProfileAnswer) => {
    if (!profile) return;
    router.push({
      pathname: '/answer/[answerId]',
      params: {
        answerId: answer.answerId,
        userId: profile.isSelf ? 'self' : profile.userId,
        firstName: profile.firstName,
        age: profile.age != null ? String(profile.age) : '',
        city: profile.city ?? '',
        distanceMiles: profile.distanceMiles != null ? String(profile.distanceMiles) : '',
        streakDays: profile.streakDays != null ? String(profile.streakDays) : '',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <CenteredSpinner dark />
      </View>
    );
  }

  if (failed || !profile) {
    return (
      <View style={[styles.root, styles.centered, { padding: PROFILE_PAD }]}>
        <StatusBar style="light" />
        <Text style={styles.muted}>
          {profile === null && !failed ? 'Profile not found.' : "We couldn't load this profile."}
        </Text>
        {showBack ? <BackButton onPress={() => router.back()} hero /> : null}
        <TextLink label="Try Again" onPress={loadProfile} color={colors.accentDog} />
      </View>
    );
  }

  const heroUrl = avatarPhoto(profile.photos)?.url;
  const streak = formatStreakBadge(profile.streakDays ?? 0);
  const locationLine = formatProfileLocation(profile.city, profile.distanceMiles);
  const previewAnswers = profile.isSelf ? answers.slice(0, PREVIEW_COUNT) : answers;
  const thumbW = (screenW - PROFILE_PAD * 2 - 12) / 3;

  const contentPad = { paddingHorizontal: PROFILE_PAD };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {!profile.isSelf ? (
        <MoreOptionsMenu
          visible={social.menuOpen}
          isFollowed={isFollowed}
          onDismiss={social.closeMenu}
          onSelect={social.runMenuAction}
        />
      ) : null}
      <ScrollView
        onScroll={profile.isSelf ? undefined : onScrollEnd}
        scrollEventThrottle={400}
        contentContainerStyle={{ paddingBottom: PROFILE_SCROLL_BOTTOM + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {profile.isSelf ? (
          <View style={[styles.hero, { height: HERO_HEIGHT_SELF }]}>
            {heroUrl ? <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <LinearGradient
              colors={['#00000000', '#000000E6']}
              style={[StyleSheet.absoluteFill, { top: '50%' }]}
              pointerEvents="none"
            />
            <View style={[styles.heroBottom, contentPad]}>
              <ProfileHeroName profile={profile} showFollowing={false} />
              {locationLine ? (
                <View style={styles.heroLocationRow}>
                  <MapPin size={16} color="#FFFFFFB3" />
                  <Text style={styles.heroMetaText}>{locationLine}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={[styles.hero, { height: HERO_HEIGHT_OTHER }]}>
            {heroUrl ? <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <LinearGradient colors={['#000000A6', '#00000000']} style={styles.heroTopScrim} pointerEvents="none" />
            <LinearGradient colors={['#00000000', '#000000E6']} style={styles.heroBottomScrim} pointerEvents="none" />
            {showBack ? (
              <View style={[styles.heroTopRow, { paddingTop: insets.top + 8 }, contentPad]}>
                <BackButton onPress={() => router.back()} hero />
              </View>
            ) : null}
            <View style={[styles.heroBottom, contentPad]}>
              <ProfileHeroName profile={profile} showFollowing={isFollowed} />
              <View style={styles.heroMetaAndActions}>
                {locationLine ? (
                  <View style={styles.heroMetaRow}>
                    <MapPin size={16} color="#FFFFFFB3" />
                    <Text style={styles.heroMetaText} numberOfLines={1}>
                      {locationLine}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroMetaRow} />
                )}
                <View style={styles.heroActionsRow} collapsable={false}>
                  <ProfileHeroIconButton onPress={social.openMenu} accessibilityLabel="More options">
                    <EllipsisVertical size={20} color={colors.white} />
                  </ProfileHeroIconButton>
                  <ProfileHeroIconButton onPress={social.onHeartPress} accessibilityLabel="Match">
                    <Heart size={20} color={colors.white} fill={heartOn ? colors.white : 'transparent'} />
                  </ProfileHeroIconButton>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.content, contentPad]}>
          {profile.isSelf ? (
            <>
              <View style={styles.statsGroup}>
                <View style={styles.statsRow}>
                  {streak ? <ProfileStatBadge icon={<Flame size={12} color={colors.accentDog} />} label={streak} /> : null}
                  {profile.matchCount != null ? (
                    <ProfileStatBadge icon={<Heart size={12} color={colors.accentDog} />} label={`${profile.matchCount} matches`} />
                  ) : null}
                  <ProfileStatBadge
                    icon={<Calendar size={12} color={colors.textDarkMuted} />}
                    label={formatJoinedShort(profile.joinedAt)}
                    mutedIcon
                  />
                </View>
                <View style={styles.statsRow}>
                  <ProfileStatBadge
                    icon={<Users size={12} color={colors.accentDog} />}
                    label={`${profile.followerCount ?? 0} followers`}
                  />
                  <ProfileStatBadge
                    icon={<Users size={12} color={colors.accentDog} />}
                    label={`${profile.profileViewCount ?? 0} profile views`}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Your Answers</Text>
                  {totalAnswers > PREVIEW_COUNT ? (
                    <TextLink label="See all" onPress={() => router.push('/my-answers')} color={colors.accentDog} size={12} />
                  ) : null}
                </View>
                <View style={styles.thumbsRow}>
                  {previewAnswers.map((a) => (
                    <ProfileAnswerPreviewThumb key={a.answerId} answer={a} width={thumbW} onPress={() => openAnswer(a)} />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Photos</Text>
                {galleryPhotoBanner ? <ErrorBanner message={galleryPhotoBanner} /> : null}
                <ProfilePhotoGrid
                  photos={profile.photos}
                  onPhotoPress={openPhotos}
                  ownProfile
                  onAddPhotoPress={() => void onAddGalleryPhoto()}
                  addPhotoDisabled={galleryPhotoBusy}
                />
              </View>

              <ProfileAccountSection
                onLogOut={() => signOutToWelcome(router)}
              />
            </>
          ) : (
            <>
              {matchState === 'sent' || matchSentBanner ? (
                <MatchRequestSentBanner firstName={profile.firstName} />
              ) : null}
              {matchState === 'incoming' && incomingRequest ? (
                <IncomingMatchCard
                  firstName={profile.firstName}
                  questionText={incomingRequest.questionText}
                  requestedAt={formatRelativeTime(incomingRequest.requestedAt)}
                  onDecline={() =>
                    confirmDeclineMatch(
                      {
                        firstName: profile.firstName,
                        gender: profile.gender,
                        avatarUri: avatarPhoto(profile.photos)?.url,
                      },
                      async () => {
                        await declineMatchRequest(profile.userId);
                        setMatchState('none');
                        setIncomingRequest(null);
                      }
                    )
                  }
                  onAccept={() =>
                    confirmAcceptMatch(
                      {
                        firstName: profile.firstName,
                        gender: profile.gender,
                        avatarUri: avatarPhoto(profile.photos)?.url,
                      },
                      async () => {
                        const matchId = await acceptMatchRequest(profile.userId);
                        setMatchState('matched');
                        setIncomingRequest(null);
                        if (matchId) {
                          router.push({
                            pathname: '/chat/[matchId]',
                            params: { matchId, justMatched: '1' },
                          });
                        }
                      }
                    )
                  }
                />
              ) : null}
              {canNudge ? (
                <NudgeCard
                  firstName={profile.firstName}
                  gender={profile.gender}
                  alreadyNudged={alreadyNudged}
                  onNudge={() =>
                    confirmNudge(
                      {
                        firstName: profile.firstName,
                        gender: profile.gender,
                        avatarUri: avatarPhoto(profile.photos)?.url,
                      },
                      async () => {
                        await nudgeUser(profile.userId);
                        setAlreadyNudged(true);
                        setCanNudge(false);
                      }
                    )
                  }
                />
              ) : null}
              <View style={styles.statsRow}>
                {streak ? <ProfileStatBadge icon={<Flame size={12} color={colors.accentDog} />} label={streak} /> : null}
                <ProfileStatBadge
                  icon={<Calendar size={12} color={colors.textDarkMuted} />}
                  label={formatJoinedMonthYear(profile.joinedAt)}
                  mutedIcon
                />
              </View>

              {profile.aboutMe ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.bodyMuted}>{profile.aboutMe}</Text>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <ProfilePhotoGrid
                  photos={profile.photos}
                  onPhotoPress={openPhotos}
                  firstName={profile.firstName}
                />
              </View>

              <View style={styles.infoSection}>
                <View style={styles.chipRow}>
                  {profile.heightInches ? (
                    <ProfileInfoChip
                      icon={<Ruler size={13} color={colors.textDarkMuted} />}
                      label={formatHeightFeetInches(profile.heightInches)}
                    />
                  ) : null}
                </View>
                {profile.occupation ? (
                  <View style={styles.chipRow}>
                    <ProfileInfoChip
                      icon={<Briefcase size={13} color={colors.textDarkMuted} />}
                      label={profile.occupation}
                    />
                  </View>
                ) : null}
                {profile.school ? (
                  <View style={styles.chipRow}>
                    <ProfileInfoChip
                      icon={<GraduationCap size={13} color={colors.textDarkMuted} />}
                      label={profile.school}
                    />
                  </View>
                ) : null}
              </View>

              {profile.interests.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Interests</Text>
                  <View style={styles.chipRow}>
                    {profile.interests.map((t) => <ProfileTagChip key={t} label={t} />)}
                  </View>
                </View>
              ) : null}

              {profile.interestedIn.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Interested in</Text>
                  <View style={styles.chipRow}>
                    {profile.interestedIn.map((t) => <ProfileTagChip key={t} label={t} />)}
                  </View>
                </View>
              ) : null}

              {profile.relationshipGoal ? (
                <View style={styles.goalCard}>
                  <Target size={18} color={colors.accentDog} />
                  <View style={styles.goalText}>
                    <Text style={styles.goalLabel}>Looking for</Text>
                    <Text style={styles.goalValue}>{profile.relationshipGoal}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{profile.firstName}&apos;s Answers</Text>
                  <Text style={styles.countLabel}>{totalAnswers} total</Text>
                </View>
                <View style={styles.archiveList}>
                  {previewAnswers.map((a) => (
                    <ProfileArchiveCard key={a.answerId} answer={a} onPress={() => openAnswer(a)} />
                  ))}
                </View>
                {loadingMore ? <Text style={styles.loadingMore}>Loading more…</Text> : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDark },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  hero: { width: '100%', justifyContent: 'flex-end', backgroundColor: colors.surfaceDark },
  heroTopScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 100 },
  heroBottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  heroTopRow: { position: 'absolute', left: 0, right: 0, top: 0 },
  heroBottom: {
    gap: 6,
    paddingBottom: 16,
    zIndex: 2,
  },
  heroMetaAndActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 44,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroNameIdentity: {
    flexDirection: 'row',
    alignItems: Platform.OS === 'ios' ? 'baseline' : 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0,
  },
  heroName: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 28,
    color: colors.white,
    includeFontPadding: false,
  },
  heroIdentity: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 16,
    color: '#FFFFFFB3',
    includeFontPadding: false,
    flexShrink: 0,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    height: 44,
  },
  heroMetaText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFFFFFB3',
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  content: { paddingTop: 20, gap: 24 },
  statsGroup: { gap: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: profileType.sectionTitle,
  countLabel: profileType.countLabel,
  bodyMuted: profileType.bodyMuted,
  thumbsRow: { flexDirection: 'row', gap: 6 },
  infoSection: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accentDogTint,
    borderRadius: 16,
    padding: 14,
  },
  goalText: { flex: 1, gap: 2 },
  goalLabel: profileType.goalLabel,
  goalValue: profileType.goalValue,
  archiveList: { gap: 8 },
  loadingMore: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted, textAlign: 'center', paddingVertical: 8 },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textDarkMuted, textAlign: 'center' },
});
