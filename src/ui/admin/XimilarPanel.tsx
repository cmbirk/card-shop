import { useState } from 'react';
import type { Card } from '@shared/types';
import { checkWithXimilar, cachedCheck, cardEligible, suggestionsFor, isMismatch, confirmAlternative, type XimilarCheck } from '../../admin/enrich';

interface Props {
  card: Card;
  /** apply a suggested field into the (unsaved) form state */
  onPatch: (fn: (c: Card) => Card) => void;
  onError: (msg: string | null) => void;
}

/**
 * "Check with Ximilar" inside the card form: identify the stored scan, then a per-field
 * "use suggested" diff. Prices are context only — a deliberate button fills the form field,
 * saving stays the admin's move. Mismatches disable suggestions and yell.
 */
export function XimilarPanel({ card, onPatch, onError }: Props) {
  const [check, setCheck] = useState<XimilarCheck | null>(() => cachedCheck(card));
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  if (!cardEligible(card)) return null;

  const run = async (force: boolean) => {
    setBusy(true);
    onError(null);
    try {
      setCheck(await checkWithXimilar(card, force));
      setPicked(new Set());
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const r = check?.result;
  const price = r?.price;
  const mismatch = check ? isMismatch(card, check) : false;
  const sugg = check && !mismatch ? suggestionsFor(card, check) : [];

  return (
    <fieldset className="ximilar-panel">
      <legend>Ximilar</legend>
      {!check ? (
        <div className="admin-toolbar">
          <span className="admin-help">Identify this scan against Ximilar's card database (~10 credits).</span>
          <button type="button" className="btn secondary" disabled={busy} onClick={() => void run(false)}>
            {busy ? 'Checking…' : 'Check with Ximilar'}
          </button>
        </div>
      ) : (
        <>
          <div className="admin-toolbar">
            <span className="admin-help">
              {r?.outcome === 'match' && (
                <>
                  {r.source === 'slab' ? 'Read off the grading label: ' : 'Matched '}
                  <b>{r.card?.fullName}</b>
                  {r.source === 'slab' && r.slab ? <> · {r.slab.company} {r.slab.grade}{r.slab.cert ? ` · cert ${r.slab.cert}` : ''}{r.slab.beckett && <> · <a className="linkish" href={r.slab.beckett} target="_blank" rel="noreferrer">Beckett↗</a></>}</> : ` (d=${r.distance?.toFixed(2)})`}
                  {' '}· checked {new Date(check.checkedAt).toLocaleDateString()}
                </>
              )}
              {r?.outcome === 'ambiguous' && <>Not sure — could be one of the below.</>}
              {r && r.outcome !== 'match' && r.outcome !== 'ambiguous' && <>Couldn't identify this scan ({r.outcome.replace('_', ' ')}).</>}
            </span>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void run(true)} title="Spend ~10 credits to re-check">
              ↻
            </button>
          </div>

          {mismatch && (
            <div className="ximilar-mismatch">
              ⚠ Ximilar thinks this is <b>{r?.card?.fullName}</b>, not {card.playerName} — check the scan and the listing before trusting either.
            </div>
          )}

          {r?.outcome === 'ambiguous' && (
            <div className="ximilar-alts">
              {[r.card?.fullName, ...(r.alternatives ?? [])].filter(Boolean).map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip${check.confirmedAs === name ? ' active' : ''}`}
                  onClick={() => void confirmAlternative(card.id, check, name!).then(setCheck)}
                >
                  {check.confirmedAs === name ? '✓ ' : ''}
                  {name}
                </button>
              ))}
              <span className="admin-help">Pick the one it actually is (identity only — no fields are changed).</span>
            </div>
          )}

          {sugg.length > 0 && (
            <table className="admin-table ximilar-diff">
              <thead>
                <tr>
                  <th />
                  <th>Field</th>
                  <th>Listing</th>
                  <th>Ximilar</th>
                </tr>
              </thead>
              <tbody>
                {sugg.map((s) => (
                  <tr key={s.field}>
                    <td className="chk">
                      <input
                        type="checkbox"
                        checked={picked.has(s.field)}
                        onChange={(e) =>
                          setPicked((p) => {
                            const n = new Set(p);
                            if (e.target.checked) n.add(s.field);
                            else n.delete(s.field);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td>{s.label}</td>
                    <td className="dim-cell">{s.ours}</td>
                    <td>
                      <b>{s.theirs}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {r?.outcome === 'match' && sugg.length === 0 && !mismatch && <p className="admin-help">✓ Every field already agrees with Ximilar.</p>}
          <div className="admin-toolbar">
            {price && (
              <span className="admin-help">
                💰 Recent sales ({price.kind}): median <b>${price.median.toFixed(2)}</b> · {price.volume} sales · ${price.min.toFixed(0)}–${price.max.toFixed(0)}
                {r?.card?.ebay && (
                  <>
                    {' '}
                    · <a className="linkish" href={r.card.ebay} target="_blank" rel="noreferrer">eBay comps</a>
                  </>
                )}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {price && (
              <button type="button" className="btn secondary" onClick={() => onPatch((c) => ({ ...c, price: Math.round(price.median * 100) }))} title="Fills the price field — you still save">
                Use median as price
              </button>
            )}
            {sugg.length > 0 && (
              <button
                type="button"
                className="btn"
                disabled={picked.size === 0}
                onClick={() => {
                  for (const s of sugg) if (picked.has(s.field)) onPatch(s.apply);
                  setPicked(new Set());
                }}
                title="Fills the form fields — you still save"
              >
                Use selected ({picked.size})
              </button>
            )}
          </div>
        </>
      )}
    </fieldset>
  );
}
