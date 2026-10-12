import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { syncDeviceTimeZone } from './api';
import { supabase } from './supabase';

type SessionState = { session: Session | null; loading: boolean; recovering: boolean; clearRecovering: () => void };

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  recovering: false,
  clearRecovering: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
      if (s) syncDeviceTimeZone().catch(() => {});
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    syncDeviceTimeZone().catch(() => {});
  }, [session?.user.id]);

  return (
    <SessionContext.Provider value={{ session, loading, recovering, clearRecovering: () => setRecovering(false) }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
