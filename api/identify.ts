import { requireUser } from './_lib/auth.js';
import { json } from './_lib/stripe.js';

export const maxDuration = 30;

// "Show Chris a card": photo → Ximilar /collectibles/v2/analyze → a normalized outcome the
// client can hand to Chris. JWT-gated (credits cost real money), per-user rate-limited
// (best effort — instances are ephemeral), thresholds calibrated 2026-08-30 against real
// scans: confident match 0.333; blurry photo → best_match null; garbage → Ximilar 500.

const LIMIT_PER_MIN = 5;
const hits = new Map<string, number[]>();

export interface Identified {
  outcome: 'match' | 'ambiguous' | 'unidentified' | 'unclear' | 'too_far' | 'not_a_card';
  card?: { fullName: string; name?: string; year?: number; setName?: string; cardNumber?: string; team?: string; subcategory?: string };
  alternatives?: string[];
  price?: { median: number; min: number; max: number; volume: number; kind: string } | null;
  distance?: number;
}

interface XObject {
  name: string;
  prob: number;
  area?: number;
  _identification?: {
    best_match?: Record<string, unknown> | null;
    alternatives?: { full_name?: string; name?: string }[];
    distances?: number[];
  };
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth.ok || !auth.userId) return json({ error: 'sign in first' }, 401);
  const key = process.env.XIMILAR_API_KEY;
  if (!key) return json({ error: 'card identification is not configured' }, 503);

  const now = Date.now();
  const mine = (hits.get(auth.userId) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= LIMIT_PER_MIN) return json({ error: 'easy — give it a few seconds between photos' }, 429);
  mine.push(now);
  hits.set(auth.userId, mine);

  let image: string;
  try {
    const body = (await req.json()) as { image?: string };
    image = String(body.image ?? '').replace(/^data:image\/\w+;base64,/, '');
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (!image || image.length > 6_000_000) return json({ error: 'image missing or too large' }, 400);

  let res: Response;
  try {
    res = await fetch('https://api.ximilar.com/collectibles/v2/analyze', {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ _base64: image }], price_stats: true }),
    });
  } catch (e) {
    console.error('[identify]', e);
    return json({ error: 'the loupe is fogged up — try again in a moment' }, 502);
  }
  const out = (await res.json().catch(() => null)) as { records?: { _objects?: XObject[]; _status?: { code: number } }[] } | null;
  // garbage input comes back as a 500 "Error processing images"
  if (res.status >= 500 || !out?.records?.length) return json({ result: { outcome: 'not_a_card' } satisfies Identified });
  const objects = out.records[0]._objects ?? [];
  const cardObj = objects.filter((o) => /card/i.test(o.name)).sort((a, b) => b.prob - a.prob)[0];
  if (!cardObj) return json({ result: { outcome: 'not_a_card' } satisfies Identified });
  if (cardObj.prob < 0.6) return json({ result: { outcome: 'unclear' } satisfies Identified });
  if ((cardObj.area ?? 1) < 0.1) return json({ result: { outcome: 'too_far' } satisfies Identified });

  const ident = cardObj._identification;
  const best = ident?.best_match as { full_name?: string; name?: string; year?: number | string; set_name?: string; card_number?: string; team?: string; subcategory?: string; price_stats?: { stats_type: string; value?: { median?: number; min?: number; max?: number; volume?: number } }[] } | null | undefined;
  const d = ident?.distances?.[0];
  if (!best || d == null) return json({ result: { outcome: 'unidentified' } satisfies Identified });

  const alternatives = (ident?.alternatives ?? []).map((a) => a.full_name ?? a.name ?? '').filter(Boolean).slice(0, 3);
  const ps = (best.price_stats ?? []).find((p) => p.value?.median != null);
  const price = ps?.value?.median != null ? { median: ps.value.median, min: ps.value.min ?? 0, max: ps.value.max ?? 0, volume: ps.value.volume ?? 0, kind: ps.stats_type } : null;
  const card = {
    fullName: best.full_name ?? best.name ?? 'unknown card',
    name: best.name,
    year: typeof best.year === 'string' ? parseInt(best.year, 10) : best.year,
    setName: best.set_name,
    cardNumber: best.card_number,
    team: best.team,
    subcategory: best.subcategory,
  };
  console.log(`[identify] user=${auth.userId.slice(0, 8)} d=${d.toFixed(3)} "${card.fullName}"`);
  if (d <= 0.45) return json({ result: { outcome: 'match', card, price, distance: d } satisfies Identified });
  if (d <= 0.65) return json({ result: { outcome: 'ambiguous', card, alternatives, distance: d } satisfies Identified });
  return json({ result: { outcome: 'unidentified' } satisfies Identified });
}
