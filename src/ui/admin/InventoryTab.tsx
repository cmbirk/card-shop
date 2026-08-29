import { useMemo, useState } from 'react';
import type { Card } from '@shared/types';
import { formatCents } from '../../stores/basketStore';
import { deleteCards, blankCard, exportCsv } from '../../admin/adminCards';
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
          <button className="btn danger" disabled={busy || confirm.trim() !== String(selected.size)} onClick={() => void removeSelected()}>
            Delete {selected.size}
          </button>
          <button className="btn secondary" onClick={() => setSelected(new Set())}>
            Clear
          </button>
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
