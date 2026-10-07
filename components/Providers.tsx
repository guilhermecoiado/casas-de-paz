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

/* ---------------- Confirmação (modal no estilo do app, no lugar do confirm() do navegador) ---------------- */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // ação destrutiva: botão vinho
}
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; id: number } | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), []);
  const answer = (v: boolean) => { ask?.resolve(v); setAsk(null); };

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
      <ConfirmContext.Provider value={confirm}>
        {children}
        {ask && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/55 px-4 pb-[calc(var(--safe-bottom,0px)+16px)] anim-fade sm:items-center" onClick={() => answer(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="cdp-confirm-title" className="w-full max-w-sm rounded-[28px] bg-cream p-5 shadow-2xl anim-rise" onClick={(e) => e.stopPropagation()}>
              <p id="cdp-confirm-title" className={`font-display text-xl font-bold leading-tight ${ask.danger ? 'text-[#7a2618]' : 'text-ink'}`}>{ask.title}</p>
              {ask.message && (ask.message.includes('\n')
                ? <div className="mt-2 text-[15px] leading-snug text-[#6b5643]">{ask.message.split('\n').map((l, i) => <p key={i} className="truncate">{l}</p>)}</div>
                : <p className="mt-2 text-[15px] leading-snug text-[#6b5643]">{ask.message}</p>)}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button className="btn-soft w-full !px-3 outline-none" onClick={() => answer(false)}>{ask.cancelLabel ?? 'Cancelar'}</button>
                <button className={`btn w-full whitespace-nowrap !px-3 text-white ${ask.danger ? 'bg-[#7a2618]' : 'bg-terra'}`} onClick={() => answer(true)}>{ask.confirmLabel ?? 'Confirmar'}</button>
              </div>
            </div>
          </div>
        )}
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
      </ConfirmContext.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
