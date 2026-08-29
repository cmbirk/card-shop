import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

// The guestbook sign-in. Everyone signs in on entry; admins are just accounts
// flagged in the admins table. Google (one-click) + email magic link.
export function SignInPanel() {
  const open = useUIStore((s) => s.signInOpen);
  const magicSent = useAuthStore((s) => s.magicSent);
  const authError = useAuthStore((s) => s.authError);
  const [email, setEmail] = useState('');

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal signin">
        <div className="signin-sheet-head">
          <div className="signin-title">The GEM Guestbook</div>
          <div className="signin-sub">Sign in to come on in — welcome to the shop.</div>
        </div>

        {magicSent ? (
          <div className="signin-sent">
            <div style={{ fontSize: 34 }}>📬</div>
            <p>Check your email for a sign-in link. Click it and you'll be signed in here — you can close this.</p>
          </div>
        ) : (
          <>
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
