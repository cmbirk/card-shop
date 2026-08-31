import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { SHOP_NAME } from '@shared/launch';

// The guestbook sign-in. Everyone signs in on entry; admins are just accounts
// flagged in the admins table. Google (one-click) + email magic link.

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
export function SignInPanel() {
  const open = useUIStore((s) => s.signInOpen);
  const magicSent = useAuthStore((s) => s.magicSent);
  const authError = useAuthStore((s) => s.authError);
  const [email, setEmail] = useState('');
  const notice = useUIStore((s) => s.signInNotice);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal signin">
        {notice && <div className="signin-note">{notice}</div>}
        <div className="signin-sheet-head">
          <img className="signin-logo" src="/tlc-icon-dark.svg" alt="" width={200} height={200} />
          <div className="signin-title">The {SHOP_NAME} Guestbook</div>
          <div className="signin-sub">Sign in to come on in — welcome to the shop.</div>
        </div>

        {magicSent ? (
          <div className="signin-sent">
            <div style={{ fontSize: 34 }}>📬</div>
            <p>Check your email for a sign-in link. Click it and you'll be signed in here — you can close this.</p>
          </div>
        ) : (
          <>
            <button className="btn signin-google" type="button" onClick={() => useAuthStore.getState().signInWithGoogle()}>
              <GoogleMark /> Continue with Google
            </button>
            <div className="signin-or">or</div>
            <p className="signin-lead">Pop in your email and we'll send you a one-tap sign-in link — no password to remember.</p>
            <form
              className="signin-magic"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) useAuthStore.getState().signInWithMagicLink(email);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn" type="submit" disabled={!email.trim()}>
                Email me a link
              </button>
            </form>
            {authError && <div className="signin-error">{authError}</div>}
          </>
        )}

        <button className="btn secondary signin-close" onClick={() => useUIStore.getState().setSignInOpen(false)}>
          Not yet
        </button>
      </div>
    </div>
  );
}
