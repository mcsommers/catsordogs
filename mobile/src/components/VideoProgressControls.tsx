import { Pressable, StyleSheet, View } from 'react-native';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { colors } from '../theme';

type Props = {
  videoProgress: number;
  muted: boolean;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  onToggleMute: () => void;
};

/** Playback progress row: play/pause, scrub bar, mute (06 / 06k). */
export function VideoProgressControls({
  videoProgress,
  muted,
  isPlaying,
  onTogglePlayPause,
  onToggleMute,
}: Props) {
  const fill = Math.min(100, Math.max(0, videoProgress * 100));
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.actionBtn}
        onPress={onTogglePlayPause}
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
      >
        {isPlaying ? (
          <Pause size={22} color={colors.white} />
        ) : (
          <Play size={22} color={colors.white} fill={colors.white} />
        )}
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fill}%` }]} />
      </View>
      <Pressable style={styles.actionBtn} onPress={onToggleMute} accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
        {muted ? <VolumeX size={22} color={colors.white} /> : <Volume2 size={22} color={colors.white} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF2E', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.white, borderRadius: 2 },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
