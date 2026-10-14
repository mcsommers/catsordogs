import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '../theme';

const THUMB = 22;

/**
 * Two-handle slider (Feed Settings 06i: Age range and Height). Built on PanResponder so it
 * works in Expo Go. Handles can touch but not cross.
 */
export function RangeSlider({
  min,
  max,
  low,
  high,
  step = 1,
  onChange,
}: {
  min: number;
  max: number;
  low: number;
  high: number;
  step?: number;
  onChange: (low: number, high: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const latest = useRef({ low, high, width, onChange, min, max, step });
  latest.current = { low, high, width, onChange, min, max, step };
  const start = useRef(0);

  const responders = useMemo(() => {
    const make = (which: 'low' | 'high') =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Keep the drag even though the screen scrolls vertically.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = which === 'low' ? latest.current.low : latest.current.high;
        },
        onPanResponderMove: (_, g) => {
          const c = latest.current;
          const travel = Math.max(1, c.width - THUMB);
          const raw = start.current + (g.dx / travel) * (c.max - c.min);
          const snapped = Math.round(raw / c.step) * c.step;
          if (which === 'low') {
            const next = Math.min(Math.max(snapped, c.min), c.high);
            if (next !== c.low) c.onChange(next, c.high);
          } else {
            const next = Math.max(Math.min(snapped, c.max), c.low);
            if (next !== c.high) c.onChange(c.low, next);
          }
        },
      });
    return { low: make('low'), high: make('high') };
  }, []);

  const travel = Math.max(0, width - THUMB);
  const pos = (v: number) => ((v - min) / (max - min)) * travel;

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.track} />
      <View style={[styles.active, { left: pos(low) + THUMB / 2, width: Math.max(0, pos(high) - pos(low)) }]} />
      <View
        {...responders.low.panHandlers}
        hitSlop={10}
        accessibilityRole="adjustable"
        style={[styles.thumb, { left: pos(low) }]}
      />
      <View
        {...responders.high.panHandlers}
        hitSlop={10}
        accessibilityRole="adjustable"
        style={[styles.thumb, { left: pos(high) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: THUMB, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, top: (THUMB - 4) / 2, height: 4, borderRadius: 2, backgroundColor: '#00000060' },
  active: { position: 'absolute', top: (THUMB - 4) / 2, height: 4, borderRadius: 2, backgroundColor: colors.accentDog },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.accentDog,
  },
});
