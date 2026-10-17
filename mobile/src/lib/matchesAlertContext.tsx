import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getConversations, getIncomingMatchRequests } from './social';
import { matchesAlertLanding, type MatchesAlertLanding } from './matchesTabAlert';
import { useSession } from './session';
import { supabase } from './supabase';

/** Safety net when Realtime misses an event; Realtime handles instant updates. */
const POLL_MS = 30_000;

type MatchesLandingRequest = { id: number; landing: MatchesAlertLanding };

type MatchesAlertContextValue = {
  matchesAlert: boolean;
  refreshMatchesAlert: () => Promise<void>;
  /** Call when the person taps Matches from another tab, before that tab opens. */
  armMatchesLanding: () => void;
  /** The segment chosen by the latest lit-heart tap, if that tap has not been replaced. */
  matchesLandingRequest: () => MatchesLandingRequest | null;
};

const MatchesAlertContext = createContext<MatchesAlertContextValue>({
  matchesAlert: false,
  refreshMatchesAlert: async () => {},
  armMatchesLanding: () => {},
  matchesLandingRequest: () => null,
});

export function useMatchesAlert() {
  return useContext(MatchesAlertContext);
}

export function MatchesAlertProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [matchesAlert, setMatchesAlert] = useState(false);
  const landingRef = useRef<MatchesAlertLanding | null>(null);
  const landingRequestRef = useRef<MatchesLandingRequest | null>(null);
  const nextLandingId = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedMatchIdsRef = useRef<string>('');
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const syncMessageSubscriptions = useCallback(
    (matchIds: string[]) => {
      const key = matchIds.slice().sort().join(',');
      if (key === subscribedMatchIdsRef.current) return;
      subscribedMatchIdsRef.current = key;

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (matchIds.length === 0) return;

      let channel = supabase.channel(`matches-tab-alert-${session?.user.id ?? 'anon'}`);
      for (const matchId of matchIds) {
        channel = channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          () => {
            void refreshRef.current();
          }
        );
      }
      channel.subscribe();
      channelRef.current = channel;
    },
    [session?.user.id]
  );

  const refreshMatchesAlert = useCallback(async () => {
    if (!session) {
      landingRef.current = null;
      setMatchesAlert(false);
      syncMessageSubscriptions([]);
      return;
    }
    try {
      const [incoming, conversations] = await Promise.all([
        getIncomingMatchRequests(),
        getConversations(),
      ]);
      const landing = matchesAlertLanding(incoming, conversations);
      landingRef.current = landing;
      setMatchesAlert(landing !== null);
      syncMessageSubscriptions(conversations.map((c) => c.matchId));
    } catch {
      landingRef.current = null;
      setMatchesAlert(false);
    }
  }, [session, syncMessageSubscriptions]);

  refreshRef.current = refreshMatchesAlert;

  const armMatchesLanding = useCallback(() => {
    const landing = landingRef.current;
    if (!landing) {
      landingRequestRef.current = null;
      return;
    }
    nextLandingId.current += 1;
    landingRequestRef.current = { id: nextLandingId.current, landing };
  }, []);

  const matchesLandingRequest = useCallback(() => landingRequestRef.current, []);

  useEffect(() => {
    if (!session) {
      landingRef.current = null;
      landingRequestRef.current = null;
      setMatchesAlert(false);
      subscribedMatchIdsRef.current = '';
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    void refreshMatchesAlert();

    let poll: ReturnType<typeof setInterval> | null = null;
    const startPoll = () => {
      if (poll) return;
      poll = setInterval(() => {
        void refreshRef.current();
      }, POLL_MS);
    };
    const stopPoll = () => {
      if (!poll) return;
      clearInterval(poll);
      poll = null;
    };

    if (AppState.currentState === 'active') startPoll();

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshRef.current();
        startPoll();
      } else {
        stopPoll();
      }
    });

    return () => {
      stopPoll();
      appSub.remove();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      subscribedMatchIdsRef.current = '';
    };
  }, [session, refreshMatchesAlert]);

  return (
    <MatchesAlertContext.Provider value={{ matchesAlert, refreshMatchesAlert, armMatchesLanding, matchesLandingRequest }}>
      {children}
    </MatchesAlertContext.Provider>
  );
}
