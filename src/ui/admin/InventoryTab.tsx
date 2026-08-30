import { useMemo, useState } from 'react';
import type { Card } from '@shared/types';
import { formatCents } from '../../stores/basketStore';
import { deleteCards, blankCard, exportCsv } from '../../admin/adminCards';
import { checkWithXimilar, cardEligible, isMismatch } from '../../admin/enrich';
import { CardForm } from './CardForm';

interface Props {
  cards: Card[];
  loading: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}

/** The inventory table + edit form, with multi-select for bulk delete and CSV export. */
export function InventoryTab({ cards, loading, onChanged, onError }: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Card | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [enrich, setEnrich] = useState<{ running: boolean; done: number; total: number; matched: number; mismatches: string[]; skipped: number } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [c.id, c.playerName, c.team, c.setName, c.brand, c.parallel, String(c.year), c.sport, c.category, c.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [cards, query]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const removeSelected = async () => {
    if (confirm.trim() !== String(selected.size)) return;
    setBusy(true);
    onError(null);
    try {
      await deleteCards([...selected]);
      setSelected(new Set());
      setConfirm('');
      await onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // bulk "Check with Ximilar": paced under the server's 5/min limit, cache-aware, procedural/
  // personal cards skipped. Mismatches (Ximilar disagrees on the player) surface as a report.
  const bulkEnrich = async () => {
    const chosen = cards.filter((c) => selected.has(c.id));
    const eligible = chosen.filter((c) => cardEligible(c) && c.status !== 'personal');
    const skipped = chosen.length - eligible.length;
    if (eligible.length === 0) {
      onError('None of the selected cards have real scans to check.');
      return;
    }
    if (!window.confirm(`Check ${eligible.length} card${eligible.length === 1 ? '' : 's'} with Ximilar (≈ ${eligible.length * 10} credits, ~${Math.ceil((eligible.length * 13) / 60)} min)?${skipped ? ` ${skipped} skipped (no scan / personal).` : ''}`)) return;
    setEnrich({ running: true, done: 0, total: eligible.length, matched: 0, mismatches: [], skipped });
    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      try {
        const check = await checkWithXimilar(c);
        setEnrich((s) => s && {
          ...s,
          done: i + 1,
          matched: s.matched + (check.result.outcome === 'match' && !isMismatch(c, check) ? 1 : 0),
          mismatches: isMismatch(c, check) ? [...s.mismatches, `${c.playerName} → Ximilar says ${check.result.card?.fullName}`] : s.mismatches,
        });
      } catch (e) {
        onError((e as Error).message);
        setEnrich((s) => s && { ...s, done: i + 1 });
      }
      if (i < eligible.length - 1) await new Promise((r) => setTimeout(r, 13_000)); // 5/min server limit
    }
    setEnrich((s) => s && { ...s, running: false });
    await onChanged();
  };

  const download = () => {
    const blob = new Blob([exportCsv(filtered)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gem-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (editing) {
    return (
      <CardForm
        initial={editing}
        isNew={!cards.some((c) => c.id === editing.id)}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await onChanged();
        }}
        onDeleted={async () => {
          setEditing(null);
          await onChanged();
        }}
        onError={onError}
      />
    );
  }

  return (
    <>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Search player, set, team, id…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <button className="btn" onClick={() => setEditing(blankCard())}>
          + Add card
        </button>
        <button className="btn secondary" onClick={download} title="Export the rows shown as CSV">
          ⤓ CSV
        </button>
      </div>

      {selected.size > 0 && (
        <div className="admin-bulk">
          <span>
            <b>{selected.size}</b> selected
          </span>
          <input
            className="admin-search admin-confirm-input"
            placeholder={`type ${selected.size} to confirm`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button className="btn secondary" disabled={busy || enrich?.running} onClick={() => void bulkEnrich()} title="Identify the selected cards' scans against Ximilar">
            🔍 Ximilar check
          </button>
          <button className="btn danger" disabled={busy || confirm.trim() !== String(selected.size)} onClick={() => void removeSelected()}>
            Delete {selected.size}
          </button>
          <button className="btn secondary" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {enrich && (
        <div className="admin-bulk" style={{ borderColor: 'var(--gold)', background: 'rgba(255,217,122,0.08)' }}>
          <span>
            {enrich.running ? `Checking ${enrich.done}/${enrich.total}…` : `Done: ${enrich.done} checked`} · {enrich.matched} matched
            {enrich.skipped > 0 && ` · ${enrich.skipped} skipped`}
            {enrich.mismatches.length > 0 && (
              <>
                {' '}· <b style={{ color: 'var(--red)' }}>{enrich.mismatches.length} mismatched:</b> {enrich.mismatches.join(' · ')}
              </>
            )}
          </span>
          {!enrich.running && (
            <button className="btn secondary" onClick={() => setEnrich(null)}>
              ✕
            </button>
          )}
        </div>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="chk">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  title="Select all shown"
                  onChange={(e) =>
                    setSelected((s) => {
                      const n = new Set(s);
                      filtered.forEach((c) => (e.target.checked ? n.add(c.id) : n.delete(c.id)));
                      return n;
                    })
                  }
                />
              </th>
              <th>Card</th>
              <th>Sport</th>
              <th>Shelf</th>
              <th>Status</th>
              <th className="num">Price</th>
              <th className="num">Cost</th>
              <th>Scan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={c.status !== 'available' ? 'dim' : ''}>
                <td className="chk" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                </td>
                <td onClick={() => setEditing(c)}>
                  <div className="admin-card-name">
                    {c.year} {c.playerName}
                    {c.isRookie && <span className="tag">RC</span>}
                    {c.grade && (
                      <span className="tag">
                        {c.grade.company} {c.grade.value}
                      </span>
                    )}
                  </div>
                  <div className="admin-card-sub">
                    {[c.brand, c.setName, c.parallel, c.cardNumber && (c.cardNumber.startsWith('#') ? c.cardNumber : `#${c.cardNumber}`)].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td onClick={() => setEditing(c)}>{c.sport}</td>
                <td onClick={() => setEditing(c)}>{c.category}</td>
                <td onClick={() => setEditing(c)}>{c.status}</td>
                <td className="num" onClick={() => setEditing(c)}>
                  {formatCents(c.price)}
                </td>
                <td className="num" onClick={() => setEditing(c)}>
                  {c.costBasis != null ? formatCents(c.costBasis) : '—'}
                </td>
                <td onClick={() => setEditing(c)}>{c.images?.front ? '📷' : ''}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="admin-empty">
                  {cards.length === 0 ? 'No cards in the database yet.' : 'Nothing matches.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
