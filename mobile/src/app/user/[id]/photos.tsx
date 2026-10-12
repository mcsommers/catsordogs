import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchUserProfile, type ProfilePhoto } from '../../../lib/profile';
import { BackButton, CenteredSpinner, Screen } from '../../../components/ui';
import { colors, fonts } from '../../../theme';

const INDICATOR_HEIGHT = 52;
const TOP_BAR_EXTRA = 48;

/** 06ja Profile Photos — horizontal paging; each photo letterboxed and fully on screen. */
export default function ProfilePhotosScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const insets = useSafeAreaInsets();
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [index, setIndex] = useState(() => Math.max(0, Number(start ?? 0)));
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<ProfilePhoto>>(null);

  const galleryHeight = Math.max(
    200,
    windowHeight - insets.top - insets.bottom - INDICATOR_HEIGHT - TOP_BAR_EXTRA
  );

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchUserProfile(id);
        if (p) setPhotos(p.photos);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const data = useMemo(() => photos.filter((p) => p.url), [photos]);

  const startIndex = useMemo(() => {
    const raw = Math.max(0, Number(start ?? 0));
    if (data.length === 0) return 0;
    return Math.min(raw, data.length - 1);
  }, [data.length, start]);

  const snapToPage = useCallback(
    (offsetX: number) => {
      const i = Math.round(offsetX / pageWidth);
      const clamped = Math.max(0, Math.min(i, data.length - 1));
      setIndex(clamped);
    },
    [data.length, pageWidth]
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      snapToPage(e.nativeEvent.contentOffset.x);
    },
    [snapToPage]
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const primary = viewableItems.find((v) => v.isViewable && v.index != null);
    if (primary?.index != null) setIndex(primary.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 85 }).current;

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({ length: pageWidth, offset: pageWidth * i, index: i }),
    [pageWidth]
  );

  if (loading) {
    return (
      <Screen dark edges={['top', 'bottom']}>
        <CenteredSpinner dark />
      </Screen>
    );
  }

  return (
    <Screen dark edges={['top', 'bottom']}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => router.back()} dark />
      </View>

      <View style={[styles.gallery, { height: galleryHeight }]}>
        <FlatList
          ref={listRef}
          data={data}
          horizontal
          pagingEnabled
          bounces={data.length > 1}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToInterval={pageWidth}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => p.storage_path}
          getItemLayout={getItemLayout}
          initialScrollIndex={data.length > 0 ? startIndex : undefined}
          onScrollToIndexFailed={(info) => {
            requestAnimationFrame(() => {
              listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            });
          }}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width: pageWidth, height: galleryHeight }]}>
              {item.url ? (
                <Image
                  source={{ uri: item.url }}
                  style={{ width: pageWidth, height: galleryHeight }}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          )}
        />
      </View>

      <View style={[styles.indicatorWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Text style={styles.indicator}>{data.length === 0 ? '0 of 0' : `${index + 1} of ${data.length}`}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 12, zIndex: 2 },
  gallery: { width: '100%' },
  list: { flexGrow: 0 },
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgDark,
  },
  indicatorWrap: { height: INDICATOR_HEIGHT, justifyContent: 'center' },
  indicator: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDarkMuted,
  },
});
