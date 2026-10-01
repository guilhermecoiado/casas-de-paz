'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { Splash } from './Splash';

/* ---------------- Auth ---------------- */

interface AuthCtx {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  ready: false, session: null, userId: null, profile: null,
  refreshProfile: async () => {}, signOut: async () => {},
});
export const useAuth = () => useContext(AuthContext);

/* ---------------- Toast ---------------- */

type ToastKind = 'ok' | 'error' | 'info';
const ToastContext = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; id: number } | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    // tela de abertura animada uma vez por sessão
    try {
      if (!sessionStorage.getItem('cdp-splash')) {
        setShowSplash(true);
        sessionStorage.setItem('cdp-splash', '1');
        setTimeout(() => setShowSplash(false), 1700);
      }
    } catch {}

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s?.user.id);
    });

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const show = useCallback((msg: string, kind: ToastKind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ msg, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value: AuthCtx = {
    ready,
    session,
    userId: session?.user.id ?? null,
    profile,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut();
      try { localStorage.removeItem('cdp-last-group'); } catch {}
    },
  };

  return (
    <AuthContext.Provider value={value}>
      <ToastContext.Provider value={show}>
        {children}
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4 anim-rise"
            style={{ top: 'calc(var(--safe-top) + 12px)' }}
          >
            <div
              className={`max-w-sm rounded-2xl px-4 py-3 text-center text-sm font-bold shadow-xl ${
                toast.kind === 'error' ? 'bg-[#7a2618] text-white' : toast.kind === 'info' ? 'bg-ink text-white' : 'bg-olive text-white'
              }`}
            >
              {toast.msg}
            </div>
          </div>
        )}
        {showSplash && <Splash />}
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
