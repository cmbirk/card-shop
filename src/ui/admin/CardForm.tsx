import { useState } from 'react';
import type { Card, GradeCompany, RawCondition } from '@shared/types';
import { saveCard, deleteCard, uploadCardImage, newCardId } from '../../admin/adminCards';
import { prepareScan, fileFromDataTransfer } from '../../admin/imagePrep';

const SPORTS: Card['sport'][] = ['baseball', 'basketball', 'football', 'hockey', 'tcg'];
const CATEGORIES = ['rookies', 'vintage', 'stars', 'graded-slabs', 'budget-box', 'budget-box-b', 'collection'];
const RARITIES: Card['rarity'][] = ['common', 'rare', 'premium', 'graded'];
const AUTOGRAPHS: NonNullable<Card['autograph']>[] = ['none', 'on-card', 'sticker'];
const RELICS: NonNullable<Card['relic']>[] = ['none', 'jersey', 'patch', 'multi-patch', 'bat', 'other'];
const STATUSES: NonNullable<Card['status']>[] = ['available', 'reserved', 'sold', 'personal'];
const GRADERS: GradeCompany[] = ['PSA', 'BGS', 'TAG', 'SGC', 'CGC'];
const CONDITIONS: RawCondition[] = ['NM-MT', 'NM', 'EX-MT', 'EX', 'VG-EX', 'VG', 'GOOD', 'POOR'];

/** "12.50" ↔ 1250 */
const centsToInput = (c: number | undefined) => (c == null ? '' : (c / 100).toFixed(2));
const inputToCents = (s: string) => {
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return s.trim() === '' ? undefined : Number.isFinite(n) ? Math.round(n * 100) : undefined;
};

/**
 * Dollar amount stored as integer cents. Keeps the raw text while you type (a controlled
 * number input that re-formats to two decimals on every keystroke can't be typed into) and
 * formats on blur.
 */
function MoneyInput({ cents, onCents, required, placeholder }: { cents: number | undefined; onCents: (c: number | undefined) => void; required?: boolean; placeholder?: string }) {
  const [text, setText] = useState(centsToInput(cents));
  const [focused, setFocused] = useState(false);
  // external change while not editing (e.g. a different card loaded) → resync
  const shown = focused ? text : centsToInput(cents);
  return (
    <input data-1p-ignore
      type="text"
      inputMode="decimal"
      placeholder={placeholder ?? '0.00'}
      value={shown}
      required={required}
      onFocus={(e) => {
        setText(centsToInput(cents));
        setFocused(true);
        e.target.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        onCents(inputToCents(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        setText(centsToInput(inputToCents(text) ?? cents));
      }}
    />
  );
}

interface FormProps {
  initial: Card;
  isNew: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onError: (msg: string | null) => void;
}

export function CardForm({ initial, isNew, onCancel, onSaved, onDeleted, onError }: FormProps) {
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
    const id = card.id.trim() || newCardId(card.sport);
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

  const [stage, setStage] = useState('');
  const [dragOver, setDragOver] = useState<'front' | 'back' | 'form' | null>(null);

  const upload = async (side: 'front' | 'back', file: File | undefined) => {
    if (!file) return;
    const id = card.id.trim() || newCardId(card.sport);
    setUploading(side);
    setStage('reading…');
    onError(null);
    try {
      const prepared = await prepareScan(file, setStage); // HEIC → JPEG, downscale
      setStage('uploading…');
      const url = await uploadCardImage(prepared.file, id, side);
      setCard((c) => ({
        ...c,
        id,
        // the front scan decides the card's orientation
        ...(side === 'front' ? { landscape: prepared.landscape } : {}),
        images: side === 'front' ? { ...(c.images ?? {}), front: url } : { front: c.images?.front ?? '', ...c.images, back: url },
      }));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setUploading(null);
      setStage('');
    }
  };

  // drop anywhere on the form: fills the front, then the back
  const onFormDrop = (e: React.DragEvent) => {
    const f = fileFromDataTransfer(e.dataTransfer);
    if (!f) return;
    e.preventDefault();
    setDragOver(null);
    void upload(card.images?.front ? 'back' : 'front', f);
  };

  return (
    <form
      autoComplete="off"
      className={`admin-form${dragOver === 'form' ? ' drag-over' : ''}`}
      onSubmit={submit}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          if (dragOver === null) setDragOver('form');
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(null);
      }}
      onDrop={onFormDrop}
    >
      <div className="admin-form-title">
        {isNew ? 'New card' : `Editing ${card.id}`}
        {!isNew && card.updatedAt && <span className="admin-card-sub"> · updated {new Date(card.updatedAt).toLocaleString()}</span>}
      </div>

      <fieldset>
        <legend>Identity</legend>
        <div className="grid">
          <label title="Generated — unique per physical card, never derived from its details">
            Id
            <input data-1p-ignore value={card.id} readOnly style={{ fontFamily: "ui-monospace, monospace", opacity: 0.7 }} />
          </label>
          <label>
            Sport
            <select
              value={card.sport}
              onChange={(e) => {
                const sport = e.target.value as Card['sport'];
                // a new card's generated id carries the sport prefix — keep it in step until first save
                patch(isNew ? { sport, id: newCardId(sport) } : { sport });
              }}
            >
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
            <input data-1p-ignore value={card.playerName} onChange={(e) => patch({ playerName: e.target.value })} required />
          </label>
          <label>
            Team
            <input data-1p-ignore value={card.team} onChange={(e) => patch({ team: e.target.value })} />
          </label>
          <label>
            Year
            <input data-1p-ignore type="number" value={card.year || ''} onChange={(e) => patch({ year: num(e.target.value) ?? 0 })} />
          </label>
          <label>
            Brand
            <input data-1p-ignore value={card.brand ?? ''} placeholder="Topps, Panini…" onChange={(e) => patch({ brand: e.target.value || undefined })} />
          </label>
          <label className="wide">
            Set
            <input data-1p-ignore value={card.setName} onChange={(e) => patch({ setName: e.target.value })} />
          </label>
          <label>
            Card #
            <input data-1p-ignore value={card.cardNumber} onChange={(e) => patch({ cardNumber: e.target.value })} />
          </label>
          <label>
            Subset / insert
            <input data-1p-ignore value={card.subset ?? ''} onChange={(e) => patch({ subset: e.target.value || undefined })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Variant &amp; hits</legend>
        <div className="grid">
          <label>
            Parallel
            <input data-1p-ignore value={card.parallel ?? ''} placeholder="Base, Refractor…" onChange={(e) => patch({ parallel: e.target.value || undefined })} />
          </label>
          <label>
            Print run /X
            <input data-1p-ignore type="number" value={card.printRun ?? ''} onChange={(e) => patch({ printRun: num(e.target.value) ?? null })} />
          </label>
          <label>
            Serial #
            <input data-1p-ignore type="number" value={card.serialNumber ?? ''} onChange={(e) => patch({ serialNumber: num(e.target.value) })} />
          </label>
          <label>
            Variation
            <input data-1p-ignore value={card.variation ?? ''} placeholder="SP / SSP / error…" onChange={(e) => patch({ variation: e.target.value || undefined })} />
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
              <input data-1p-ignore type="checkbox" checked={!!card.isRookie} onChange={(e) => patch({ isRookie: e.target.checked })} /> Rookie
            </label>
            <label>
              <input data-1p-ignore type="checkbox" checked={!!card.isInsert} onChange={(e) => patch({ isInsert: e.target.checked })} /> Insert
            </label>
            <label>
              <input data-1p-ignore type="checkbox" checked={!!card.isError} onChange={(e) => patch({ isError: e.target.checked })} /> Error
            </label>
            <label>
              <input data-1p-ignore type="checkbox" checked={!!card.foil} onChange={(e) => patch({ foil: e.target.checked })} /> Foil
            </label>
            <label title="Set automatically from the front scan; override if needed">
              <input data-1p-ignore type="checkbox" checked={!!card.landscape} onChange={(e) => patch({ landscape: e.target.checked })} /> Horizontal card
            </label>
            <label>
              <input data-1p-ignore type="checkbox" checked={!!card.featured} onChange={(e) => patch({ featured: e.target.checked })} /> Featured (display case)
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
                <input data-1p-ignore type="number" step="0.5" value={grade.value} onChange={(e) => patchGrade({ value: Number(e.target.value), label: '' })} />
              </label>
              <label>
                Label
                <input data-1p-ignore value={grade.label} placeholder="PSA 10 GEM MT" onChange={(e) => patchGrade({ label: e.target.value })} />
              </label>
              <label>
                Cert #
                <input data-1p-ignore value={grade.certNumber ?? ''} onChange={(e) => patchGrade({ certNumber: e.target.value || undefined })} />
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
            <MoneyInput cents={card.price} onCents={(c) => patch({ price: c ?? 0 })} required />
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
            <input data-1p-ignore type="number" min="0" value={card.quantity ?? 1} onChange={(e) => patch({ quantity: num(e.target.value) ?? 1 })} />
          </label>
          <label>
            Cost basis $ <span className="admin-only">admin</span>
            <MoneyInput cents={card.costBasis} onCents={(c) => patch({ costBasis: c })} placeholder="what you paid" />
          </label>
          <label>
            Acquired <span className="admin-only">admin</span>
            <input data-1p-ignore type="date" value={card.acquiredDate ?? ''} onChange={(e) => patch({ acquiredDate: e.target.value || undefined })} />
          </label>
          <label>
            From <span className="admin-only">admin</span>
            <input data-1p-ignore value={card.acquiredFrom ?? ''} placeholder="eBay, show, trade…" onChange={(e) => patch({ acquiredFrom: e.target.value || undefined })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Scans</legend>
        <div className="admin-scans">
          {(['front', 'back'] as const).map((side) => {
            const url = side === 'front' ? card.images?.front : card.images?.back;
            return (
              <label
                key={side}
                className={`admin-scan${dragOver === side ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(side);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(null);
                  void upload(side, fileFromDataTransfer(e.dataTransfer));
                }}
              >
                <span>{side}</span>
                {url && uploading !== side ? <img src={url} alt={`${side} scan`} /> : <div className="admin-scan-empty">{uploading === side ? stage || 'working…' : 'drop a photo\nor click'}</div>}
                <input data-1p-ignore type="file" accept="image/*,.heic,.heif" disabled={!!uploading} onChange={(e) => void upload(side, e.target.files?.[0])} />
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
            <input data-1p-ignore value={card.lore.funFact ?? ''} onChange={(e) => patch({ lore: { ...card.lore, funFact: e.target.value || undefined } })} />
          </label>
          <label className="wide">
            Investment note
            <input data-1p-ignore value={card.lore.investmentNote ?? ''} onChange={(e) => patch({ lore: { ...card.lore, investmentNote: e.target.value || undefined } })} />
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
