import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export const CAPTION_COLLAPSED_HEIGHT = 48;

type Props = {
  text: string;
  fallback?: string;
  /** When this changes, caption collapses again (new feed item / answer). */
  resetKey?: string;
};

/**
 * Two-line caption with tail ellipsis; tap toggles full text.
 * Uses a hidden full-layout pass because onTextLayout on the clipped Text is unreliable on Android.
 */
export function ExpandableCaption({ text, fallback = 'No captions for this answer.', resetKey }: Props) {
  const caption = text?.trim() ? text : fallback;
  const [expanded, setExpanded] = useState(false);
  const [fullLineCount, setFullLineCount] = useState(1);

  useEffect(() => {
    setExpanded(false);
    setFullLineCount(1);
  }, [resetKey]);

  const canExpand = fullLineCount > 2;

  return (
    <Pressable
      style={[styles.box, !expanded && styles.boxCollapsed]}
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Collapse caption' : canExpand ? 'Expand caption' : 'Caption'}
      accessibilityState={{ expanded }}
    >
      <View style={styles.inner}>
        <Text
          style={[styles.caption, styles.measure]}
          accessible={false}
          importantForAccessibility="no"
          onTextLayout={(e) => setFullLineCount(e.nativeEvent.lines.length)}
        >
          {caption}
        </Text>
        <Text
          style={styles.caption}
          pointerEvents="none"
          numberOfLines={expanded ? undefined : 2}
          ellipsizeMode="tail"
        >
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#00000080',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  boxCollapsed: {
    height: CAPTION_COLLAPSED_HEIGHT,
    justifyContent: 'center',
  },
  inner: { position: 'relative', width: '100%' },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.white },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
});
