import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Status = 'loading' | 'signed-out' | 'admin';

type AuthValue = {
  status: Status;
  email: string | null;
  rejection: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function adopt(session: Session | null) {
      if (!session) {
        if (!cancelled) {
          setEmail(null);
          setStatus('signed-out');
        }
        return;
      }
      const { data, error } = await supabase.rpc('is_admin');
      if (cancelled) return;
      if (error || data !== true) {
        await supabase.auth.signOut();
        setEmail(null);
        setRejection('This tool is only for admins. An admin has to add you by hand in the database.');
        setStatus('signed-out');
        return;
      }
      setRejection(null);
      setEmail(session.user.email ?? null);
      setStatus('admin');
    }
    supabase.auth.getSession().then(({ data }) => adopt(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer so this callback does not call Supabase while its own lock is held.
      setTimeout(() => adopt(session), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(nextEmail: string, password: string) {
    setRejection(null);
    const { error } = await supabase.auth.signInWithPassword({ email: nextEmail.trim(), password });
    if (error) return error.message;
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, email, rejection, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <p className="muted">Checking who you are…</p>;
  if (status !== 'admin') return <Navigate to="/" replace />;
  return children;
}
