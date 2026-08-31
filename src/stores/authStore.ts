import { create } from 'zustand';
import { logEvent } from '../systems/analytics';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSeller: boolean; // consignment: has a row in `sellers`
  firstVisit: boolean; // profile says visits === 1 (or no profile yet)
  ready: boolean; // initial session check finished
  magicSent: boolean; // magic-link email dispatched
  authError: string | null;
  init: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

async function checkFirstVisit(userId: string | undefined): Promise<boolean> {
  if (!supabase || !userId) return true;
  const { data } = await supabase.from('profiles').select('visits').eq('id', userId).maybeSingle();
  return !data || (data as { visits: number }).visits <= 1;
}

async function checkAdmin(userId: string | undefined): Promise<boolean> {
  if (!supabase || !userId) return false;
  const { data } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

async function checkSeller(userId: string | undefined): Promise<boolean> {
  if (!supabase || !userId) return false;
  const { data } = await supabase.from('sellers').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isAdmin: false,
  isSeller: false,
  firstVisit: true,
  // When Supabase isn't configured (local dev before setup), treat as "ready"
  // and let the app run ungated so nothing is bricked.
  ready: !supabaseConfigured,
  magicSent: false,
  authError: null,

  init: () => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      set({ session, user: session?.user ?? null, isAdmin: await checkAdmin(session?.user?.id), isSeller: await checkSeller(session?.user?.id), firstVisit: await checkFirstVisit(session?.user?.id), ready: true });
    });
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !get().session) {
        const provider = session.user.app_metadata?.provider;
        logEvent('sign_in', { method: provider === 'google' ? 'google' : 'magic' });
      }
      set({
        session,
        user: session?.user ?? null,
        isAdmin: await checkAdmin(session?.user?.id),
        isSeller: await checkSeller(session?.user?.id),
        firstVisit: await checkFirstVisit(session?.user?.id),
        ready: true,
        magicSent: false,
      });
    });
  },

  signInWithGoogle: async () => {
    if (!supabase) return;
    set({ authError: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) set({ authError: error.message });
  },

  signInWithMagicLink: async (email) => {
    if (!supabase) return;
    set({ authError: null });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) set({ authError: error.message });
    else set({ magicSent: true });
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ session: null, user: null, isAdmin: false, isSeller: false, magicSent: false });
  },
}));

/** The current access token, for authorizing API calls (e.g. /api/chat). */
export function accessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null;
}
