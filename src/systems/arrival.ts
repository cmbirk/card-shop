import { useUIStore } from '../stores/uiStore';

// Invited-arrival handling: ?invited=1 comes from the invite email's walk-right-in link
// (supabase-js consumes the auth token in the hash itself). Also turns a stale link's
// error hash into a friendly re-sign-in instead of a dead end.

export function handleArrival(): void {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const invited = params.get('invited') === '1';
  const stale = hash.get('error_code') === 'otp_expired' || hash.get('error') === 'access_denied';
  if (!invited && !stale) return;
  history.replaceState(null, '', window.location.pathname);
  const ui = useUIStore.getState();
  if (invited) ui.setInvitedArrival(true);
  if (stale) {
    ui.setSignInNotice("That link went stale — no harm done. Pop your email in and we'll send a fresh one.");
    ui.setSignInOpen(true);
  }
}
