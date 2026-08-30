import { useEffect, useMemo, useState } from 'react';
import type { Card, ConsignStatus } from '@shared/types';
import { formatCents } from '../../stores/basketStore';
import { adminSetConsignStatus, adminListPayouts, adminMarkPaid, notifyConsign, type AdminPayoutRow } from '../../admin/consign';
import { CardForm } from './CardForm';

interface Props {
  cards: Card[];
  onChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}

const SECTIONS: { status: ConsignStatus; title: string; hint: string }[] = [
  { status: 'submitted', title: 'Waiting for review', hint: 'Approve sets the sticker price; the seller then ships it to you.' },
  { status: 'approved', title: 'In the mail to you', hint: 'Mark received when the card is in hand and matches the scans.' },
  { status: 'received', title: 'In hand — not yet out', hint: 'List puts it in the On Consignment case.' },
  { status: 'listed', title: 'On the floor', hint: '' },
  { status: 'withdraw_requested', title: 'Return requested', hint: 'Confirm once you have shipped the card back.' },
  { status: 'rejected', title: 'Rejected', hint: '' },
];

/** Chris's consignment desk: review queue by stage + the payout ledger. */
export function ConsignTab({ cards, onChanged, onError }: Props) {
  const [reviewing, setReviewing] = useState<Card | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);

  const consigned = useMemo(() => cards.filter((c) => c.consignorId || c.consignStatus), [cards]);
  const by = (s: ConsignStatus) => consigned.filter((c) => c.consignStatus === s);
  const owed = payouts.filter((p) => p.status === 'owed' && !p.test_mode);

  const refreshPayouts = async () => {
    try {
      setPayouts(await adminListPayouts());
    } catch (e) {
      onError((e as Error).message);
    }
  };
  useEffect(() => {
    void refreshPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (id: string, fn: () => Promise<void>, event?: string) => {
    setBusy(id);
    onError(null);
    try {
      await fn();
      if (event) notifyConsign(id, event);
      await onChanged();
      await refreshPayouts();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reject = (c: Card) => {
    const note = window.prompt(`Why pass on the ${c.year} ${c.playerName}? (the seller sees this)`, 'Condition is rougher than the scans show — pass for now.');
    if (note === null) return;
    void act(c.id, () => adminSetConsignStatus(c.id, 'rejected', note), 'rejected');
  };

  const markPaid = (p: AdminPayoutRow) => {
    const method = window.prompt('Paid how? (venmo / zelle / cash…)', 'venmo');
    if (method === null) return;
    const reference = window.prompt('Reference (txn id, note — optional)', '') ?? '';
    void act(p.card_id, () => adminMarkPaid(p, method, reference), 'paid');
  };

  if (reviewing) {
    return (
      <>
        <p className="admin-help">
          Reviewing <b>{reviewing.year} {reviewing.playerName}</b> — asked {reviewing.askingPrice != null ? formatCents(reviewing.askingPrice) : '—'}.
          Set the sticker price, shelf and lore, then approve.
        </p>
        <CardForm
          initial={reviewing}
          isNew={false}
          onCancel={() => setReviewing(null)}
          onSaved={async () => {
            await adminSetConsignStatus(reviewing.id, 'approved');
            notifyConsign(reviewing.id, 'approved');
            setReviewing(null);
            await onChanged();
          }}
          onDeleted={async () => {
            setReviewing(null);
            await onChanged();
          }}
          onError={onError}
        />
      </>
    );
  }

  return (
    <div className="consign-list">
      {consigned.length === 0 && <p className="admin-help">No consignments yet. Invite a seller from the Users tab; their submissions land here.</p>}
      {SECTIONS.map(({ status, title, hint }) => {
        const rows = by(status);
        if (rows.length === 0) return null;
        return (
          <div key={status}>
            <div className="consign-ledger-head">
              {title} ({rows.length})
            </div>
            {hint && <p className="admin-help">{hint}</p>}
            {rows.map((c) => (
              <div key={c.id} className="consign-row">
                <div className="consign-card">
                  <div className="admin-card-name">
                    {c.year} {c.playerName}
                    {c.grade && (
                      <span className="tag">
                        {c.grade.company} {c.grade.value}
                      </span>
                    )}
                    {c.images?.front && <span className="tag">📷</span>}
                  </div>
                  <div className="admin-card-sub">
                    {[c.setName, c.cardNumber].filter(Boolean).join(' ')} · from <b>{c.consignorDisplay ?? c.consignorId?.slice(0, 8) ?? '?'}</b> · asked{' '}
                    {c.askingPrice != null ? formatCents(c.askingPrice) : '—'}
                    {c.price > 0 && ` · sticker ${formatCents(c.price)}`}
                  </div>
                </div>
                <div className="consign-actions">
                  {status === 'submitted' && (
                    <>
                      <button className="btn" disabled={busy === c.id} onClick={() => setReviewing(c)}>
                        Review & approve
                      </button>
                      <button className="btn secondary danger-text" disabled={busy === c.id} onClick={() => reject(c)}>
                        Pass
                      </button>
                    </>
                  )}
                  {status === 'approved' && (
                    <button className="btn" disabled={busy === c.id} onClick={() => void act(c.id, () => adminSetConsignStatus(c.id, 'received'), 'received')}>
                      Mark received
                    </button>
                  )}
                  {status === 'received' && (
                    <button
                      className="btn"
                      disabled={busy === c.id || c.price <= 0}
                      title={c.price <= 0 ? 'Set a price first (Review)' : 'Put it in the On Consignment case'}
                      onClick={() => void act(c.id, () => adminSetConsignStatus(c.id, 'listed'), 'listed')}
                    >
                      List it
                    </button>
                  )}
                  {(status === 'submitted' || status === 'received' || status === 'listed') && status !== 'submitted' && (
                    <button className="btn secondary" disabled={busy === c.id} onClick={() => setReviewing(c)}>
                      Edit
                    </button>
                  )}
                  {status === 'withdraw_requested' && (
                    <button className="btn secondary" disabled={busy === c.id} onClick={() => void act(c.id, () => adminSetConsignStatus(c.id, 'withdrawn'))}>
                      Confirm returned
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="consign-ledger-head">Payouts{owed.length > 0 && ` — ${formatCents(owed.reduce((s, p) => s + p.amount, 0))} owed`}</div>
      {payouts.length === 0 ? (
        <p className="admin-help">Nothing owed yet — payout rows appear here when a consigned card sells.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Seller</th>
              <th className="num">Sold for</th>
              <th className="num">Their cut</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className={p.test_mode ? 'dim' : ''}>
                <td className="mono">{p.card_id}</td>
                <td>{p.seller_handle ?? p.seller_id?.slice(0, 8) ?? '—'}</td>
                <td className="num">{formatCents(p.sale_price)}</td>
                <td className="num">
                  {formatCents(p.amount)} <span className="admin-card-sub">({p.split_pct}%)</span>
                </td>
                <td>{p.test_mode ? 'dry run' : p.status === 'paid' ? `paid · ${p.method ?? ''} ${p.reference ?? ''}` : 'owed'}</td>
                <td>
                  {p.status === 'owed' && !p.test_mode && (
                    <button className="btn" disabled={busy === p.card_id} onClick={() => markPaid(p)}>
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
