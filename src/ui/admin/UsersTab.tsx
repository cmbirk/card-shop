import { useEffect, useState } from 'react';
import { listUsers, setAdmin, setSeller, setSellerSplit, type Visitor } from '../../admin/adminUsers';
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
  const toggle = (u: Visitor) => run(u.id, () => setAdmin(u.id, !u.isAdmin));
  const toggleSeller = (u: Visitor) => run(u.id, () => setSeller(u.id, !u.isSeller, u.splitPct ?? 85));
  const changeSplit = (u: Visitor, pct: number) => {
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return;
    void run(u.id, () => setSellerSplit(u.id, Math.round(pct)));
  };

  return (
    <>
      <div className="admin-toolbar">
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
    </>
  );
}
