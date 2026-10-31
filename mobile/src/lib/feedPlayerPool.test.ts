import { createVideoPlayer } from 'expo-video';
import {
  FEED_PLAYER_KEEP_RADIUS,
  clearFeedPlayerPool,
  getFeedPlayer,
  keepFeedPlayerIdsForIndex,
  pauseAllFeedPlayers,
  retainFeedPlayers,
} from './feedPlayerPool';

jest.mock('expo-video', () => ({
  createVideoPlayer: jest.fn(),
}));

type MockPlayer = {
  loop: boolean;
  muted: boolean;
  pause: jest.Mock;
  release: jest.Mock;
};

function mockPlayer(): MockPlayer {
  return {
    loop: false,
    muted: false,
    pause: jest.fn(),
    release: jest.fn(),
  };
}

const mockedCreate = jest.mocked(createVideoPlayer);

beforeEach(() => {
  mockedCreate.mockReset();
  mockedCreate.mockImplementation(() => mockPlayer() as never);
  clearFeedPlayerPool();
  mockedCreate.mockClear();
});

afterEach(() => {
  clearFeedPlayerPool();
});

describe('keepFeedPlayerIdsForIndex', () => {
  const items = [{ answerId: 'a' }, { answerId: 'b' }, { answerId: 'c' }, { answerId: 'd' }];

  it('keeps the active clip and one neighbor', () => {
    expect(FEED_PLAYER_KEEP_RADIUS).toBe(1);
    expect(keepFeedPlayerIdsForIndex(items, 0)).toEqual(['a', 'b']);
    expect(keepFeedPlayerIdsForIndex(items, 2)).toEqual(['b', 'c', 'd']);
    expect(keepFeedPlayerIdsForIndex(items, 3)).toEqual(['c', 'd']);
  });

  it('clamps an index past the last video (caught-up page)', () => {
    expect(keepFeedPlayerIdsForIndex(items, 8)).toEqual(['c', 'd']);
  });

  it('returns nothing when the feed is empty', () => {
    expect(keepFeedPlayerIdsForIndex([], 0)).toEqual([]);
  });
});

describe('getFeedPlayer', () => {
  it('reuses the same native player for the same clip and url', () => {
    const first = getFeedPlayer('a', 'https://a/playlist.m3u8');
    const second = getFeedPlayer('a', 'https://a/playlist.m3u8');
    expect(second).toBe(first);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('releases the old player when the signed url changes', () => {
    const first = getFeedPlayer('a', 'https://a/old.m3u8') as unknown as MockPlayer;
    const second = getFeedPlayer('a', 'https://a/new.m3u8');
    expect(first.release).toHaveBeenCalledTimes(1);
    expect(second).not.toBe(first);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });
});

describe('retainFeedPlayers', () => {
  it('releases players that leave the keep window and leaves neighbors intact', () => {
    const a = getFeedPlayer('a', 'https://a') as unknown as MockPlayer;
    const b = getFeedPlayer('b', 'https://b') as unknown as MockPlayer;
    const c = getFeedPlayer('c', 'https://c') as unknown as MockPlayer;
    const d = getFeedPlayer('d', 'https://d') as unknown as MockPlayer;
    const e = getFeedPlayer('e', 'https://e') as unknown as MockPlayer;

    retainFeedPlayers(keepFeedPlayerIdsForIndex(
      [{ answerId: 'a' }, { answerId: 'b' }, { answerId: 'c' }, { answerId: 'd' }, { answerId: 'e' }],
      2,
    ));

    expect(a.release).toHaveBeenCalledTimes(1);
    expect(e.release).toHaveBeenCalledTimes(1);
    expect(b.release).not.toHaveBeenCalled();
    expect(c.release).not.toHaveBeenCalled();
    expect(d.release).not.toHaveBeenCalled();
    expect(getFeedPlayer('b', 'https://b')).toBe(b);
    expect(getFeedPlayer('c', 'https://c')).toBe(c);
    expect(getFeedPlayer('d', 'https://d')).toBe(d);
  });

  it('does not release the current window so a profile round-trip can reuse it', () => {
    const a = getFeedPlayer('a', 'https://a') as unknown as MockPlayer;
    const b = getFeedPlayer('b', 'https://b') as unknown as MockPlayer;
    retainFeedPlayers(['a', 'b']);
    pauseAllFeedPlayers();
    expect(a.release).not.toHaveBeenCalled();
    expect(b.release).not.toHaveBeenCalled();
    expect(a.pause).toHaveBeenCalled();
    expect(getFeedPlayer('a', 'https://a')).toBe(a);
  });
});

describe('clearFeedPlayerPool', () => {
  it('releases every cached player', () => {
    const a = getFeedPlayer('a', 'https://a') as unknown as MockPlayer;
    const b = getFeedPlayer('b', 'https://b') as unknown as MockPlayer;
    clearFeedPlayerPool();
    expect(a.release).toHaveBeenCalledTimes(1);
    expect(b.release).toHaveBeenCalledTimes(1);
    getFeedPlayer('a', 'https://a');
    expect(mockedCreate).toHaveBeenCalledTimes(3);
  });
});
