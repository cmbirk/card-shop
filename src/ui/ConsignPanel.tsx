import { useEffect, useState } from 'react';
import type { Card } from '@shared/types';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { formatCents } from '../stores/basketStore';
import { blankCard } from '../admin/adminCards';
import {
  myConsignments,
  myPayouts,
  myShipAddress,
  setMyShipAddress,
  deleteConsignment,
  requestWithdraw,
  resubmit,
  notifyConsign,
  CONSIGN_STATUS_LABEL,
  type PayoutRow,
} from '../admin/consign';
import { CardForm } from './admin/CardForm';

// "My consignments" — the seller's side door. A DOM overlay (NOT the back office; the STAFF
// ONLY door stays admin-only): submit cards with an asking price, watch the status timeline,
// see the earnings ledger. Chris approves/prices/lists from the admin ConsignTab.

const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

export function ConsignPanel() {
  const open = useUIStore((s) => s.consignOpen);
  const isSeller = useAuthStore((s) => s.isSeller);
  const [cards, setCards] = useState<Card[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [editing, setEditing] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressSaved, setAddressSaved] = useState(false);

  const refresh = async () => {
    setError(null);
    try {
      const [c, p, a] = await Promise.all([myConsignments(), myPayouts(), myShipAddress()]);
      setCards(c);
      setPayouts(p);
      setAddress(a ?? '');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (open && isSeller) void refresh();
  }, [open, isSeller]);

  if (!open || !isSeller) return null;
  const close = () => useUIStore.getState().setConsignOpen(false);

  const act = async (id: string, fn: () => Promise<void>, event?: string) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      if (event) notifyConsign(id, event);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const owed = payouts.filter((p) => p.status === 'owed' && !p.test_mode).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="modal-backdrop">
      <div className="modal admin consign">
        <div className="admin-head">
          <div>
            <div className="signin-title">My Consignments</div>
            <div className="signin-sub">
              {cards.length} card{cards.length === 1 ? '' : 's'} with Chris{owed > 0 ? ` · ${formatCents(owed)} owed to you` : ''}
            </div>
          </div>
          <div className="admin-head-actions">
            {!editing && (
              <button className="btn" onClick={() => setEditing({ ...blankCard(), askingPrice: undefined })}>
                + Consign a card
              </button>
            )}
            <button className="btn secondary" onClick={close}>
              ✕ Close
            </button>
          </div>
        </div>
        {error && <div className="signin-error">{error}</div>}

        {editing ? (
          <CardForm
            initial={editing}
            isNew={!cards.some((c) => c.id === editing.id)}
            mode="seller"
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              notifyConsign(editing.id, 'submitted');
              setEditing(null);
              await refresh();
            }}
            onDeleted={async () => {
              setEditing(null);
              await refresh();
            }}
            onError={setError}
          />
        ) : (
          <div className="consign-list">
            {cards.length === 0 && (
              <p className="admin-help">
                Nothing here yet. Hit <b>+ Consign a card</b>, add photos and your asking price, and Chris will take a look. Once he approves,
                you ship him the card; when it sells, your cut lands in the ledger below.
              </p>
            )}
            {cards.map((c) => (
              <div key={c.id} className="consign-row">
                <div className="consign-card">
                  <div className="admin-card-name">
                    {c.year} {c.playerName}
                    {c.grade && (
                      <span className="tag">
                        {c.grade.company} {c.grade.value}
                      </span>
                    )}
                  </div>
                  <div className="admin-card-sub">
                    {[c.setName, c.cardNumber].filter(Boolean).join(' ')} · asked {c.askingPrice != null ? formatCents(c.askingPrice) : '—'}
                    {c.consignStatus === 'listed' && c.price > 0 && ` · listed at ${formatCents(c.price)}`}
                  </div>
                  {c.consignStatus === 'rejected' && c.consignNote && <div className="consign-note">Chris: “{c.consignNote}”</div>}
                  {c.consignStatus === 'approved' && <div className="consign-note ok">Check your email for the shipping address.</div>}
                </div>
                <span className={`consign-chip s-${c.consignStatus}`}>{c.consignStatus ? CONSIGN_STATUS_LABEL[c.consignStatus] : '—'}</span>
                <div className="consign-actions">
                  {(c.consignStatus === 'submitted' || c.consignStatus === 'rejected') && (
                    <>
                      <button className="btn secondary" disabled={busy === c.id} onClick={() => setEditing(c)}>
                        Edit
                      </button>
                      {c.consignStatus === 'rejected' && (
                        <button className="btn secondary" disabled={busy === c.id} onClick={() => void act(c.id, () => resubmit(c.id), 'submitted')}>
                          Resubmit
                        </button>
                      )}
                      <button className="btn secondary danger-text" disabled={busy === c.id} onClick={() => void act(c.id, () => deleteConsignment(c.id))}>
                        Remove
                      </button>
                    </>
                  )}
                  {(c.consignStatus === 'approved' || c.consignStatus === 'received' || c.consignStatus === 'listed') && (
                    <button
                      className="btn secondary"
                      disabled={busy === c.id || c.status === 'reserved'}
                      title={c.status === 'reserved' ? 'Someone is checking out with it right now' : 'Ask Chris to send it back'}
                      onClick={() => void act(c.id, () => requestWithdraw(c.id))}
                    >
                      Request return
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="consign-ledger-head">Your return address</div>
            <p className="admin-help">Where Chris ships cards back to you (returns, or if a consignment doesn't work out).</p>
            <div className="consign-address">
              <textarea
                data-1p-ignore
                rows={2}
                placeholder={'Name\nStreet, City ST ZIP'}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddressSaved(false);
                }}
              />
              <button
                className="btn secondary"
                disabled={busy === 'addr'}
                onClick={() =>
                  void act('addr', async () => {
                    await setMyShipAddress(address);
                    setAddressSaved(true);
                  })
                }
              >
                {addressSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>

            {payouts.length > 0 && (
              <>
                <div className="consign-ledger-head">Earnings</div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th className="num">Sold for</th>
                      <th className="num">Your cut</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id} className={p.test_mode ? 'dim' : ''}>
                        <td className="mono">{p.card_id}</td>
                        <td className="num">{formatCents(p.sale_price)}</td>
                        <td className="num">
                          {formatCents(p.amount)} <span className="admin-card-sub">({p.split_pct}%)</span>
                        </td>
                        <td>{p.test_mode ? 'dry run' : p.status === 'paid' ? `paid ${when(p.paid_at ?? undefined)} · ${p.method ?? ''}` : 'owed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
