import { useEffect, useMemo, useState } from 'react';
import type { Card, GradeCompany, RawCondition } from '@shared/types';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { formatCents } from '../stores/basketStore';
import { reloadInventory } from '../systems/inventory';
import { listAllCards, saveCard, deleteCard, uploadCardImage, blankCard, suggestId } from '../admin/adminCards';

// The back office. Admin-only CRUD over the `cards` table (every column,
// including sold/reserved rows and cost basis). Writes go straight to
// Supabase under the admin JWT; RLS is the real gate — this UI just hides
// itself from non-admins.

const SPORTS: Card['sport'][] = ['baseball', 'basketball', 'football', 'hockey', 'tcg'];
const CATEGORIES = ['rookies', 'vintage', 'stars', 'graded-slabs', 'budget-box', 'budget-box-b', 'colts-room'];
const RARITIES: Card['rarity'][] = ['common', 'rare', 'premium', 'graded'];
const AUTOGRAPHS: NonNullable<Card['autograph']>[] = ['none', 'on-card', 'sticker'];
const RELICS: NonNullable<Card['relic']>[] = ['none', 'jersey', 'patch', 'multi-patch', 'bat', 'other'];
const STATUSES: NonNullable<Card['status']>[] = ['available', 'reserved', 'sold', 'personal'];
const GRADERS: GradeCompany[] = ['PSA', 'BGS', 'TAG', 'SGC', 'CGC'];
const CONDITIONS: RawCondition[] = ['NM-MT', 'NM', 'EX-MT', 'EX', 'VG-EX', 'VG', 'GOOD', 'POOR'];

/** "12.50" ↔ 1250 */
const centsToInput = (c: number | undefined) => (c == null ? '' : (c / 100).toFixed(2));
const inputToCents = (s: string) => (s.trim() === '' ? undefined : Math.round(parseFloat(s) * 100) || 0);

export function AdminPanel() {
  const open = useUIStore((s) => s.adminOpen);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Card | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCards(await listAllCards());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isAdmin) void refresh();
  }, [open, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [c.id, c.playerName, c.team, c.setName, c.brand, c.parallel, String(c.year), c.sport, c.category, c.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [cards, query]);

  if (!open || !isAdmin) return null;

  const close = () => {
    setEditing(null);
    useUIStore.getState().setAdminOpen(false);
  };

  const afterWrite = async () => {
    setEditing(null);
    await refresh();
    await reloadInventory(); // shelves pick up the change without a page reload
  };

  return (
    <div className="modal-backdrop">
      <div className="modal admin">
        <div className="admin-head">
          <div>
            <div className="signin-title">Back Office</div>
            <div className="signin-sub">
              {cards.length} cards · {cards.filter((c) => c.status === 'available').length} on the floor
            </div>
          </div>
          <div className="admin-head-actions">
            <button className="btn" onClick={() => setEditing(blankCard())}>
              + Add card
            </button>
            <button className="btn secondary" onClick={() => void refresh()} disabled={loading}>
              ↻
            </button>
            <button className="btn secondary" onClick={() => void useAuthStore.getState().signOut().then(close)}>
              Sign out
            </button>
            <button className="btn secondary" onClick={close}>
              ✕
            </button>
          </div>
        </div>

        {error && <div className="signin-error">{error}</div>}

        {editing ? (
          <CardForm
            initial={editing}
            isNew={!cards.some((c) => c.id === editing.id)}
            onCancel={() => setEditing(null)}
            onSaved={afterWrite}
            onDeleted={afterWrite}
            onError={setError}
          />
        ) : (
          <>
            <input
              className="admin-search"
              placeholder="Search player, set, team, id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
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
                    <tr key={c.id} onClick={() => setEditing(c)} className={c.status !== 'available' ? 'dim' : ''}>
                      <td>
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
                      <td>{c.sport}</td>
                      <td>{c.category}</td>
                      <td>{c.status}</td>
                      <td className="num">{formatCents(c.price)}</td>
                      <td className="num">{c.costBasis != null ? formatCents(c.costBasis) : '—'}</td>
                      <td>{c.images?.front ? '📷' : ''}</td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="admin-empty">
                        {cards.length === 0 ? 'No cards in the database yet.' : 'Nothing matches.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

interface FormProps {
  initial: Card;
  isNew: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onError: (msg: string | null) => void;
}

function CardForm({ initial, isNew, onCancel, onSaved, onDeleted, onError }: FormProps) {
  const [card, setCard] = useState<Card>(initial);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const patch = (p: Partial<Card>) => setCard((c) => ({ ...c, ...p }));
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  // Grade sub-state lives on card.grade; `graded` is derived from its presence.
  const grade = card.grade;
  const patchGrade = (g: Partial<NonNullable<Card['grade']>>) =>
    setCard((c) => {
      const next = { company: 'PSA' as GradeCompany, value: 10, label: '', ...c.grade, ...g };
      if (!next.label) next.label = `${next.company} ${next.value}`;
      return { ...c, graded: true, rarity: 'graded', grade: next };
    });
  const clearGrade = () => setCard((c) => ({ ...c, graded: false, grade: undefined, rarity: c.rarity === 'graded' ? 'common' : c.rarity }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    const id = card.id.trim() || suggestId(card);
    if (!id) return onError('Give the card an id (or fill in player + year so one can be suggested).');
    if (!card.playerName.trim()) return onError('Player name is required.');
    setBusy(true);
    try {
      await saveCard({ ...card, id, graded: !!card.grade });
      await onSaved();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteCard(card.id);
      await onDeleted();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (side: 'front' | 'back', file: File | undefined) => {
    if (!file) return;
    const id = card.id.trim() || suggestId(card);
    if (!id) return onError('Set an id (or player + year) before uploading scans.');
    setUploading(side);
    onError(null);
    try {
      const url = await uploadCardImage(file, id, side);
      setCard((c) => ({
        ...c,
        id,
        images: side === 'front' ? { ...(c.images ?? {}), front: url } : { front: c.images?.front ?? '', ...c.images, back: url },
      }));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-title">
        {isNew ? 'New card' : `Editing ${card.id}`}
        {!isNew && card.updatedAt && <span className="admin-card-sub"> · updated {new Date(card.updatedAt).toLocaleString()}</span>}
      </div>

      <fieldset>
        <legend>Identity</legend>
        <div className="grid">
          <label>
            Id
            <input
              value={card.id}
              placeholder={suggestId(card) || 'auto'}
              onChange={(e) => patch({ id: e.target.value })}
              disabled={!isNew}
            />
          </label>
          <label>
            Sport
            <select value={card.sport} onChange={(e) => patch({ sport: e.target.value as Card['sport'] })}>
              {SPORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Shelf
            <select value={card.category} onChange={(e) => patch({ category: e.target.value })}>
              {CATEGORIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            Player
            <input value={card.playerName} onChange={(e) => patch({ playerName: e.target.value })} required />
          </label>
          <label>
            Team
            <input value={card.team} onChange={(e) => patch({ team: e.target.value })} />
          </label>
          <label>
            Year
            <input type="number" value={card.year || ''} onChange={(e) => patch({ year: num(e.target.value) ?? 0 })} />
          </label>
          <label>
            Brand
            <input value={card.brand ?? ''} placeholder="Topps, Panini…" onChange={(e) => patch({ brand: e.target.value || undefined })} />
          </label>
          <label className="wide">
            Set
            <input value={card.setName} onChange={(e) => patch({ setName: e.target.value })} />
          </label>
          <label>
            Card #
            <input value={card.cardNumber} onChange={(e) => patch({ cardNumber: e.target.value })} />
          </label>
          <label>
            Subset / insert
            <input value={card.subset ?? ''} onChange={(e) => patch({ subset: e.target.value || undefined })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Variant &amp; hits</legend>
        <div className="grid">
          <label>
            Parallel
            <input value={card.parallel ?? ''} placeholder="Base, Refractor…" onChange={(e) => patch({ parallel: e.target.value || undefined })} />
          </label>
          <label>
            Print run /X
            <input type="number" value={card.printRun ?? ''} onChange={(e) => patch({ printRun: num(e.target.value) ?? null })} />
          </label>
          <label>
            Serial #
            <input type="number" value={card.serialNumber ?? ''} onChange={(e) => patch({ serialNumber: num(e.target.value) })} />
          </label>
          <label>
            Variation
            <input value={card.variation ?? ''} placeholder="SP / SSP / error…" onChange={(e) => patch({ variation: e.target.value || undefined })} />
          </label>
          <label>
            Autograph
            <select value={card.autograph ?? 'none'} onChange={(e) => patch({ autograph: e.target.value as Card['autograph'] })}>
              {AUTOGRAPHS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Relic
            <select value={card.relic ?? 'none'} onChange={(e) => patch({ relic: e.target.value as Card['relic'] })}>
              {RELICS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="checks wide">
            <label>
              <input type="checkbox" checked={!!card.isRookie} onChange={(e) => patch({ isRookie: e.target.checked })} /> Rookie
            </label>
            <label>
              <input type="checkbox" checked={!!card.isInsert} onChange={(e) => patch({ isInsert: e.target.checked })} /> Insert
            </label>
            <label>
              <input type="checkbox" checked={!!card.isError} onChange={(e) => patch({ isError: e.target.checked })} /> Error
            </label>
            <label>
              <input type="checkbox" checked={!!card.foil} onChange={(e) => patch({ foil: e.target.checked })} /> Foil
            </label>
            <label>
              <input type="checkbox" checked={!!card.featured} onChange={(e) => patch({ featured: e.target.checked })} /> Featured (display case)
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Condition</legend>
        <div className="grid">
          <label>
            Graded?
            <select value={grade ? 'yes' : 'no'} onChange={(e) => (e.target.value === 'yes' ? patchGrade({}) : clearGrade())}>
              <option value="no">Raw</option>
              <option value="yes">Graded</option>
            </select>
          </label>
          {grade ? (
            <>
              <label>
                Grader
                <select value={grade.company} onChange={(e) => patchGrade({ company: e.target.value as GradeCompany, label: '' })}>
                  {GRADERS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Grade
                <input type="number" step="0.5" value={grade.value} onChange={(e) => patchGrade({ value: Number(e.target.value), label: '' })} />
              </label>
              <label>
                Label
                <input value={grade.label} placeholder="PSA 10 GEM MT" onChange={(e) => patchGrade({ label: e.target.value })} />
              </label>
              <label>
                Cert #
                <input value={grade.certNumber ?? ''} onChange={(e) => patchGrade({ certNumber: e.target.value || undefined })} />
              </label>
            </>
          ) : (
            <label>
              Raw condition
              <select value={card.rawCondition ?? ''} onChange={(e) => patch({ rawCondition: (e.target.value || undefined) as RawCondition | undefined })}>
                <option value="">—</option>
                {CONDITIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Rarity
            <select value={card.rarity} onChange={(e) => patch({ rarity: e.target.value as Card['rarity'] })}>
              {RARITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Commerce</legend>
        <div className="grid">
          <label>
            Price $
            <input type="number" step="0.01" min="0" value={centsToInput(card.price)} onChange={(e) => patch({ price: inputToCents(e.target.value) ?? 0 })} required />
          </label>
          <label>
            Status
            <select value={card.status ?? 'available'} onChange={(e) => patch({ status: e.target.value as Card['status'] })}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Qty
            <input type="number" min="0" value={card.quantity ?? 1} onChange={(e) => patch({ quantity: num(e.target.value) ?? 1 })} />
          </label>
          <label>
            Cost basis $ <span className="admin-only">admin</span>
            <input type="number" step="0.01" min="0" value={centsToInput(card.costBasis)} onChange={(e) => patch({ costBasis: inputToCents(e.target.value) })} />
          </label>
          <label>
            Acquired <span className="admin-only">admin</span>
            <input type="date" value={card.acquiredDate ?? ''} onChange={(e) => patch({ acquiredDate: e.target.value || undefined })} />
          </label>
          <label>
            From <span className="admin-only">admin</span>
            <input value={card.acquiredFrom ?? ''} placeholder="eBay, show, trade…" onChange={(e) => patch({ acquiredFrom: e.target.value || undefined })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Scans</legend>
        <div className="admin-scans">
          {(['front', 'back'] as const).map((side) => {
            const url = side === 'front' ? card.images?.front : card.images?.back;
            return (
              <label key={side} className="admin-scan">
                <span>{side}</span>
                {url ? <img src={url} alt={`${side} scan`} /> : <div className="admin-scan-empty">{uploading === side ? 'uploading…' : 'no scan'}</div>}
                <input type="file" accept="image/*" disabled={!!uploading} onChange={(e) => void upload(side, e.target.files?.[0])} />
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Lore (what Chris knows)</legend>
        <div className="grid">
          <label className="wide">
            Blurb
            <textarea rows={2} value={card.lore.blurb} onChange={(e) => patch({ lore: { ...card.lore, blurb: e.target.value } })} />
          </label>
          <label className="wide">
            Fun fact
            <input value={card.lore.funFact ?? ''} onChange={(e) => patch({ lore: { ...card.lore, funFact: e.target.value || undefined } })} />
          </label>
          <label className="wide">
            Investment note
            <input value={card.lore.investmentNote ?? ''} onChange={(e) => patch({ lore: { ...card.lore, investmentNote: e.target.value || undefined } })} />
          </label>
        </div>
      </fieldset>

      <div className="modal-actions admin-actions">
        {!isNew &&
          (confirmDelete ? (
            <>
              <span className="admin-confirm">Delete for good?</span>
              <button type="button" className="btn danger" disabled={busy} onClick={() => void remove()}>
                Yes, delete
              </button>
              <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="btn secondary danger-text" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={busy || !!uploading}>
          {busy ? 'Saving…' : 'Save card'}
        </button>
      </div>
    </form>
  );
}
