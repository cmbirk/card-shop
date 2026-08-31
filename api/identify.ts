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
  card?: { fullName: string; name?: string; year?: number; setName?: string; cardNumber?: string; team?: string; subcategory?: string; rarity?: string; company?: string; ebay?: string };
  alternatives?: string[];
  price?: { median: number; min: number; max: number; volume: number; kind: string } | null;
  distance?: number;
  /** 'slab' = read straight off the grading label (authoritative); 'image' = visual match */
  source?: 'image' | 'slab';
  slab?: { company?: string; grade?: string; cert?: string; beckett?: string };
  detectedSport?: string; // from Ximilar's Subcategory tag on the card object
}

interface XObject {
  name: string;
  prob: number;
  area?: number;
  _tags?: Record<string, { name: string; prob: number }[]>;
  _identification?: {
    best_match?: Record<string, unknown> | null;
    alternatives?: { full_name?: string; name?: string }[];
    distances?: number[];
  };
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const SPORT_TAG: Record<string, string> = { Football: 'football', Baseball: 'baseball', Basketball: 'basketball', Hockey: 'hockey', Soccer: 'football' };

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

  let image = '';
  let url = '';
  let slab = false;
  try {
    const body = (await req.json()) as { image?: string; url?: string; slab?: boolean };
    image = String(body.image ?? '').replace(/^data:image\/\w+;base64,/, '');
    url = String(body.url ?? '');
    slab = !!body.slab;
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  // enrichment runs straight from a stored Supabase scan URL — no re-upload
  if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//.test(url)) return json({ error: 'only shop scan urls' }, 400);
  if (!url && (!image || image.length > 6_000_000)) return json({ error: 'image missing or too large' }, 400);

  let res: Response;
  try {
    res = await fetch('https://api.ximilar.com/collectibles/v2/analyze', {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [url ? { _url: url } : { _base64: image }], price_stats: true, ...(slab ? { slab_id: true } : {}) }),
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

  const detectedSport = SPORT_TAG[cardObj._tags?.Subcategory?.[0]?.name ?? ''];

  // graded cards: the slab label read is authoritative (player/set/year/number/grade/cert)
  const slabObj = objects.find((o) => /slab label/i.test(o.name));
  const slabBest = slabObj?._identification?.best_match as { name?: string; brand?: string; set?: string; year?: string | number; card_no?: string; grade?: string; verbal_grade?: string; certificate_number?: string; links?: Record<string, string> } | null | undefined;
  if (slab && slabBest?.name) {
    const year = typeof slabBest.year === 'string' ? parseInt(slabBest.year, 10) : slabBest.year;
    const name = titleCase(slabBest.name);
    const setName = slabBest.set ? titleCase(slabBest.set) : undefined;
    const cardNumber = slabBest.card_no?.replace(/^#/, '');
    const company = slabObj?._tags?.Company?.[0]?.name;
    console.log(`[identify] user=${auth.userId.slice(0, 8)} slab-label "${name}" cert=${slabBest.certificate_number ?? '?'}`);
    return json({
      result: {
        outcome: 'match',
        source: 'slab',
        card: { fullName: `${year ?? ''} ${name} ${setName ?? ''} ${cardNumber ? `#${cardNumber}` : ''}`.replace(/\s+/g, ' ').trim(), name, year, setName, cardNumber, company: slabBest.brand ? titleCase(slabBest.brand) : undefined },
        slab: { company, grade: slabBest.grade, cert: slabBest.certificate_number, beckett: slabBest.links?.['beckett.com'] },
        detectedSport,
      } satisfies Identified,
    });
  }

  const ident = cardObj._identification;
  const best = ident?.best_match as { full_name?: string; name?: string; year?: number | string; set_name?: string; set?: string; card_number?: string; team?: string; subcategory?: string; rarity?: string; company?: string; links?: Record<string, string>; price_stats?: { stats_type: string; value?: { median?: number; min?: number; max?: number; volume?: number } }[] } | null | undefined;
  const d = ident?.distances?.[0];
  // Ximilar sometimes returns best_match null WITH plausible alternatives (seen on slabs):
  // that's an ambiguous result, not a dead end
  if (!best || d == null) {
    const alts = (ident?.alternatives ?? []).map((a) => a.full_name ?? a.name ?? '').filter(Boolean).slice(0, 3);
    if (alts.length && d != null && d <= 0.65) {
      return json({ result: { outcome: 'ambiguous', card: { fullName: alts[0] }, alternatives: alts, distance: d, source: 'image', detectedSport } satisfies Identified });
    }
    return json({ result: { outcome: 'unidentified', detectedSport } satisfies Identified });
  }

  const alternatives = (ident?.alternatives ?? []).map((a) => a.full_name ?? a.name ?? '').filter(Boolean).slice(0, 3);
  const ps = (best.price_stats ?? []).find((p) => p.value?.median != null);
  const price = ps?.value?.median != null ? { median: ps.value.median, min: ps.value.min ?? 0, max: ps.value.max ?? 0, volume: ps.value.volume ?? 0, kind: ps.stats_type } : null;
  const card = {
    fullName: best.full_name ?? best.name ?? 'unknown card',
    name: best.name,
    year: typeof best.year === 'string' ? parseInt(best.year, 10) : best.year,
    setName: best.set_name ?? best.set,
    cardNumber: best.card_number,
    team: best.team,
    subcategory: best.subcategory,
    rarity: best.rarity,
    company: best.company,
    ebay: best.links?.['ebay.com'],
  };
  console.log(`[identify] user=${auth.userId.slice(0, 8)} d=${d.toFixed(3)} "${card.fullName}"`);
  if (d <= 0.45) return json({ result: { outcome: 'match', card, price, distance: d, source: 'image', detectedSport } satisfies Identified });
  if (d <= 0.65) return json({ result: { outcome: 'ambiguous', card, alternatives, distance: d, source: 'image', detectedSport } satisfies Identified });
  return json({ result: { outcome: 'unidentified', detectedSport } satisfies Identified });
}
