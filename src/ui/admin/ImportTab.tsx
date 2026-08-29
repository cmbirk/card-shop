import { useMemo, useState } from 'react';
import type { Card } from '@shared/types';
import { formatCents } from '../../stores/basketStore';
import { parseImport, saveCards, CSV_TEMPLATE } from '../../admin/adminCards';

interface Props {
  existing: Card[];
  onImported: () => Promise<void>;
  onError: (msg: string | null) => void;
}

/** Bulk add: paste or upload CSV / JSON, preview what will happen, import in one go. */
export function ImportTab({ existing, onImported, onError }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const existingIds = useMemo(() => new Set(existing.map((c) => c.id)), [existing]);
  const parsed = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);
  const updates = parsed ? parsed.cards.filter((c) => existingIds.has(c.id)).length : 0;

  const onFile = (f: File | undefined) => {
    if (!f) return;
    void f.text().then(setText);
  };

  const run = async () => {
    if (!parsed || parsed.cards.length === 0) return;
    setBusy(true);
    onError(null);
    try {
      await saveCards(parsed.cards);
      setDone(parsed.cards.length);
      setText('');
      await onImported();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const template = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gem-import-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="admin-import">
      <p className="admin-help">
        Paste CSV or JSON, or pick a file. CSV headers are card fields (<code>playerName, sport, year, setName, price…</code>);
        prices in dollars. Rows with an existing <code>id</code> update that card; rows without one get an id from player + year.{' '}
        <button className="linkish" onClick={template}>
          Download the CSV template
        </button>
      </p>
      <div className="admin-toolbar">
        <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <textarea
        className="admin-paste"
        rows={8}
        placeholder={'id,sport,category,playerName,team,year,setName,cardNumber,...\n,baseball,rookies,Jane Example,Herons,2024,Pennant Craze,#12,...'}
        value={text}
        onChange={(e) => {
          setDone(null);
          setText(e.target.value);
        }}
      />

      {parsed && (
        <>
          <div className="admin-bulk">
            <span>
              <b>{parsed.cards.length}</b> ready · {parsed.cards.length - updates} new · {updates} update{updates === 1 ? '' : 's'}
              {parsed.errors.length > 0 && (
                <>
                  {' '}
                  · <span className="admin-err-count">{parsed.errors.length} row{parsed.errors.length === 1 ? '' : 's'} skipped</span>
                </>
              )}
            </span>
            <button className="btn" disabled={busy || parsed.cards.length === 0} onClick={() => void run()}>
              {busy ? 'Importing…' : `Import ${parsed.cards.length}`}
            </button>
          </div>
          {parsed.errors.length > 0 && (
            <ul className="admin-errors">
              {parsed.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  {e.row > 0 ? `Row ${e.row}: ` : ''}
                  {e.message}
                </li>
              ))}
              {parsed.errors.length > 20 && <li>…and {parsed.errors.length - 20} more</li>}
            </ul>
          )}
          <div className="admin-table-wrap admin-preview">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Id</th>
                  <th>Card</th>
                  <th>Shelf</th>
                  <th>Status</th>
                  <th className="num">Price</th>
                </tr>
              </thead>
              <tbody>
                {parsed.cards.slice(0, 200).map((c) => (
                  <tr key={c.id}>
                    <td>{existingIds.has(c.id) ? <span className="tag warn">update</span> : <span className="tag">new</span>}</td>
                    <td className="mono">{c.id}</td>
                    <td>
                      {c.year} {c.playerName} · {c.setName} {c.cardNumber}
                    </td>
                    <td>
                      {c.sport} / {c.category}
                    </td>
                    <td>{c.status}</td>
                    <td className="num">{formatCents(c.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {done !== null && <div className="admin-ok">Imported {done} card{done === 1 ? '' : 's'} — they're on the shelves now.</div>}
    </div>
  );
}
