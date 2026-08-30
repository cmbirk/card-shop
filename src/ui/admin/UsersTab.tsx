import { useEffect, useState } from 'react';
import { listUsers, setAdmin, setSeller, setSellerSplit, type Visitor } from '../../admin/adminUsers';
import { notifySellerInvited, notifyAdminInvited } from '../../admin/consign';
import { useAuthStore as auth } from '../../stores/authStore';
import { useAuthStore } from '../../stores/authStore';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Everyone who's signed the guestbook, with an Admin toggle. */
export function UsersTab({ onError }: { onError: (msg: string | null) => void }) {
  const [users, setUsers] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const me = useAuthStore((s) => s.user?.id);

  const refresh = async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    onError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const [promoting, setPromoting] = useState<Visitor | null>(null);
  const toggle = (u: Visitor) => {
    if (u.isAdmin) {
      void run(u.id, () => setAdmin(u.id, false)); // demotion: instant (self-demotion already refused)
      return;
    }
    setPromoting(u); // promotion is a big deal — confirm, and tell them it emails
  };
  const confirmPromote = () => {
    const u = promoting;
    if (!u) return;
    setPromoting(null);
    void run(u.id, async () => {
      await setAdmin(u.id, true);
      notifyAdminInvited(u.id);
    });
  };
  const toggleSeller = (u: Visitor) => {
    if (u.isSeller) {
      void run(u.id, () => setSeller(u.id, false)); // retiring sends nothing
      return;
    }
    // inviting opens a confirm modal (it sends a welcome email)
    const guess = (u.displayName ?? '').includes('@') ? '' : (u.displayName ?? '').split(' ')[0];
    setInviting(u);
    setInviteName(guess);
    setInviteSplit(u.splitPct ?? 85);
  };
  const [inviting, setInviting] = useState<Visitor | null>(null);
  const [cold, setCold] = useState(false); // the "+ Invite someone" (never-visited) modal
  const [coldEmail, setColdEmail] = useState('');
  const [coldName, setColdName] = useState('');
  const [coldSplit, setColdSplit] = useState(85);
  const [coldBusy, setColdBusy] = useState(false);
  const [coldResult, setColdResult] = useState<{ sent: boolean; link: string | null; existing: boolean } | null>(null);

  const sendInvite = async (email: string, name: string, split: number) => {
    const token = auth.getState().session?.access_token;
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email, displayName: name, splitPct: split }),
    });
    const body = (await res.json()) as { ok?: boolean; sent?: boolean; link?: string | null; existing?: boolean; error?: string };
    if (!res.ok || !body.ok) throw new Error(body.error ?? `invite failed (${res.status})`);
    return { sent: !!body.sent, link: body.link ?? null, existing: !!body.existing };
  };

  const submitCold = async () => {
    const email = coldEmail.trim().toLowerCase();
    if (!email) return;
    const already = users.find((u) => u.email?.toLowerCase() === email);
    if (already) {
      onError(`${email} has already visited — use the Seller toggle on their row instead.`);
      setCold(false);
      return;
    }
    setColdBusy(true);
    onError(null);
    try {
      setColdResult(await sendInvite(email, coldName, coldSplit));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setColdBusy(false);
    }
  };
  const [inviteName, setInviteName] = useState('');
  const [inviteSplit, setInviteSplit] = useState(85);
  const confirmInvite = () => {
    const u = inviting;
    if (!u) return;
    setInviting(null);
    void run(u.id, async () => {
      await setSeller(u.id, true, inviteSplit, inviteName.trim() || undefined);
      notifySellerInvited(u.id); // the welcome email the modal promised
    });
  };
  const changeSplit = (u: Visitor, pct: number) => {
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return;
    void run(u.id, () => setSellerSplit(u.id, Math.round(pct)));
  };

  return (
    <>
      <div className="admin-toolbar">
        <button className="btn" onClick={() => { setCold(true); setColdResult(null); setColdEmail(''); setColdName(''); setColdSplit(85); }}>
          + Invite someone
        </button>
        <span className="admin-help">
          {users.length} visitor{users.length === 1 ? '' : 's'} · {users.filter((u) => u.isAdmin).length} admin{users.filter((u) => u.isAdmin).length === 1 ? '' : 's'}
        </span>
        <button className="btn secondary" onClick={() => void refresh()} disabled={loading}>
          ↻
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Signed in with</th>
              <th>First visit</th>
              <th>Last visit</th>
              <th className="num">Visits</th>
              <th>Seller</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="admin-user">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="admin-avatar">{(u.displayName ?? u.email ?? '?').slice(0, 1).toUpperCase()}</span>}
                    <div>
                      <div className="admin-card-name">
                        {u.displayName ?? '—'}
                        {u.id === me && <span className="tag">you</span>}
                        {u.invitedAt && u.visits <= 1 && <span className="tag warn">invited · hasn't visited</span>}
                      </div>
                      <div className="admin-card-sub">{u.email ?? ''}</div>
                    </div>
                  </div>
                </td>
                <td>{u.provider ?? '—'}</td>
                <td>{when(u.firstSeen)}</td>
                <td>{when(u.lastSeen)}</td>
                <td className="num">{u.visits}</td>
                <td>
                  <label className="admin-switch" title={u.isSeller ? 'Consignment seller — click to retire' : 'Invite as a consignment seller'}>
                    <input type="checkbox" checked={u.isSeller} disabled={busy === u.id} onChange={() => void toggleSeller(u)} />
                    <span>{u.isSeller ? 'Seller' : '—'}</span>
                  </label>
                  {u.isSeller && u.invitedAt && u.visits <= 1 && u.email && (
                    <button
                      className="btn secondary"
                      style={{ marginLeft: 6 }}
                      disabled={busy === u.id}
                      title="Send them a fresh walk-right-in link"
                      onClick={() => void run(u.id, async () => void (await sendInvite(u.email!, u.displayName ?? 'there', u.splitPct ?? 85)))}
                    >
                      ↻ re-invite
                    </button>
                  )}
                  {u.isSeller && (
                    <span className="admin-split" title="The seller's cut of each sale">
                      keeps{' '}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={u.splitPct ?? 85}
                        disabled={busy === u.id}
                        onBlur={(e) => changeSplit(u, Number(e.target.value))}
                      />
                      %
                    </span>
                  )}
                </td>
                <td>
                  <label className="admin-switch" title={u.id === me ? "You can't remove your own admin access" : u.isAdmin ? 'Remove admin' : 'Make admin'}>
                    <input type="checkbox" checked={u.isAdmin} disabled={busy === u.id || u.id === me} onChange={() => void toggle(u)} />
                    <span>{u.isAdmin ? 'Admin' : 'Customer'}</span>
                  </label>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-empty">
                  Nobody has signed the guestbook yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cold && (
        <div className="modal-backdrop invite-confirm">
          <div className="modal">
            <h2>Invite someone to sell</h2>
            {coldResult ? (
              <>
                <p className="admin-help">
                  {coldResult.existing
                    ? 'They already had an account — seller access attached, and they got the welcome email.'
                    : coldResult.sent
                      ? `Done — ${coldEmail.trim()} has an invite in their inbox with a walk-right-in link.`
                      : 'Account created, but the email did not go out (domain not verified in Resend yet). Copy the link below and text it to them — it signs them straight in.'}
                </p>
                {coldResult.link && !coldResult.sent && (
                  <div className="admin-toolbar">
                    <input data-1p-ignore className="admin-search" readOnly value={coldResult.link} onFocus={(e) => e.target.select()} />
                    <button className="btn secondary" onClick={() => void navigator.clipboard?.writeText(coldResult.link!)}>
                      Copy
                    </button>
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn" onClick={() => setCold(false)}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="admin-form" style={{ overflow: 'visible' }}>
                  <div className="grid">
                    <label className="wide">
                      Email
                      <input data-1p-ignore autoFocus type="email" value={coldEmail} onChange={(e) => setColdEmail(e.target.value)} placeholder="friend@example.com" />
                    </label>
                    <label>
                      Display name <span className="admin-only">what Chris calls them</span>
                      <input data-1p-ignore value={coldName} onChange={(e) => setColdName(e.target.value)} placeholder="e.g. Maya" />
                    </label>
                    <label>
                      Their cut %
                      <input data-1p-ignore type="number" min={0} max={100} value={coldSplit} onChange={(e) => setColdSplit(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
                    </label>
                  </div>
                </div>
                <p className="admin-help" style={{ marginTop: 10 }}>
                  📬 This creates their account and emails an invite in your voice with a sign-in link. They keep <b>{coldSplit}%</b> of each
                  sale. Sellers only — admins get promoted after they've actually visited.
                </p>
                <div className="modal-actions">
                  <button className="btn secondary" onClick={() => setCold(false)}>
                    Cancel
                  </button>
                  <button className="btn" disabled={coldBusy || !coldEmail.trim() || !coldName.trim()} onClick={() => void submitCold()}>
                    {coldBusy ? 'Inviting…' : 'Invite & send email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {promoting && (
        <div className="modal-backdrop invite-confirm">
          <div className="modal">
            <h2>Make {promoting.displayName ?? promoting.email ?? 'this visitor'} an admin?</h2>
            <p className="admin-help">
              Admins get the whole Back Office: inventory (add/edit/delete every card, prices, cost basis), bulk import/export, consignment
              reviews and payouts, and this Users list — including promoting others.
            </p>
            <p className="admin-help">
              📬 This sends <b>{promoting.email ?? 'them'}</b> an email letting them know they have the keys.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPromoting(null)}>
                Not yet
              </button>
              <button className="btn" onClick={confirmPromote}>
                Make admin & send email
              </button>
            </div>
          </div>
        </div>
      )}

      {inviting && (
        <div className="modal-backdrop invite-confirm">
          <div className="modal">
            <h2>Invite {inviting.displayName ?? inviting.email ?? 'this visitor'} to sell?</h2>
            <div className="admin-form" style={{ overflow: 'visible' }}>
              <div className="grid">
                <label>
                  Display name <span className="admin-only">what Chris calls them</span>
                  <input data-1p-ignore value={inviteName} autoFocus onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. Maya" />
                </label>
                <label>
                  Their cut %
                  <input data-1p-ignore type="number" min={0} max={100} value={inviteSplit} onChange={(e) => setInviteSplit(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
                </label>
              </div>
            </div>
            <p className="admin-help" style={{ marginTop: 10 }}>
              📬 This sends <b>{inviting.email ?? 'them'}</b> a welcome email right away — how consigning works, that they keep{' '}
              <b>{inviteSplit}%</b> of each sale, and where to start. Make sure you're ready for their submissions.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setInviting(null)}>
                Not yet
              </button>
              <button className="btn" onClick={confirmInvite}>
                Invite & send email
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
