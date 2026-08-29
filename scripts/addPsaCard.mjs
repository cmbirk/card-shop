// PSA cert ingestion: look up a cert via the PSA Public API, download slab
// scans, and append/update the card in shared/data/realCards.json.
//
// Usage: node scripts/addPsaCard.mjs <certNumber> [priceCents] [--featured]
// Requires PSA_API_TOKEN in .env.local (account must be API-approved by PSA).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

if (!process.env.PSA_API_TOKEN && existsSync(join(root, '.env.local'))) {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const token = process.env.PSA_API_TOKEN;
const cert = process.argv[2];
const priceCents = Number(process.argv[3]) || 0;
const featured = process.argv.includes('--featured');
if (!token || !cert) {
  console.error('Usage: node scripts/addPsaCard.mjs <certNumber> [priceCents] [--featured]');
  process.exit(1);
}

const API = 'https://api.psacard.com/publicapi';
const headers = { Authorization: `bearer ${token}` };

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// PSA Category → our Sport
function mapSport(category) {
  const c = (category ?? '').toLowerCase();
  if (c.includes('baseball')) return 'baseball';
  if (c.includes('basketball')) return 'basketball';
  if (c.includes('football')) return 'football';
  if (c.includes('hockey')) return 'hockey';
  return 'tcg';
}

const data = await get(`/cert/GetByCertNumber/${cert}`);
const psa = data?.PSACert;
if (!psa) {
  console.error('No PSACert in response:', JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log('Cert:', JSON.stringify(psa, null, 2));

// images (optional — older certs often have none)
const images = {};
try {
  const imgResp = await get(`/cert/GetImagesByCertNumber/${cert}`);
  const list = Array.isArray(imgResp) ? imgResp : (imgResp?.Images ?? []);
  const outDir = join(root, 'public/cards/psa');
  mkdirSync(outDir, { recursive: true });
  for (const img of list) {
    const url = img.ImageURL ?? img.imageUrl;
    if (!url) continue;
    const side = (img.IsFrontImage ?? img.isFrontImage) ? 'f' : 'b';
    const file = `psa-${cert}-${side}.jpg`;
    const res = await fetch(url);
    writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
    images[side === 'f' ? 'front' : 'back'] = `/cards/psa/${file}`;
    console.log('saved', file);
  }
} catch (err) {
  console.warn('images unavailable:', err.message);
}

const grade = Number(psa.CardGrade) || 0;
const card = {
  id: `${mapSport(psa.Category).slice(0, 2)}-psa-${cert}`,
  sport: mapSport(psa.Category),
  category: 'graded-slabs',
  playerName: psa.Subject ?? 'Unknown',
  team: psa.Variety || psa.Brand || '',
  year: Number(psa.Year) || 0,
  setName: psa.Brand ?? '',
  cardNumber: psa.CardNumber ? `#${psa.CardNumber}` : '',
  rarity: 'graded',
  grade: { company: 'PSA', value: grade, label: `PSA ${psa.CardGrade} ${psa.GradeDescription ?? ''}`.trim(), certNumber: String(cert) },
  price: priceCents,
  seed: Number(cert) % 2147483647,
  featured,
  ...(Object.keys(images).length ? { images } : {}),
  lore: {
    blurb: `${psa.Year} ${psa.Brand} ${psa.Subject}${psa.Variety ? ` (${psa.Variety})` : ''}, professionally graded.`,
    ...(psa.TotalPopulation
      ? { funFact: `Population ${psa.TotalPopulation}${psa.PopulationHigher != null ? `, only ${psa.PopulationHigher} graded higher` : ''}.` }
      : {}),
  },
};

const p = join(root, 'shared/data/realCards.json');
const db = JSON.parse(readFileSync(p, 'utf8'));
const idx = db.cards.findIndex((c) => c.grade?.certNumber === String(cert));
if (idx >= 0) db.cards[idx] = { ...db.cards[idx], ...card };
else db.cards.push(card);
writeFileSync(p, JSON.stringify(db, null, 2) + '\n');
console.log(`${idx >= 0 ? 'Updated' : 'Added'} ${card.id} in realCards.json${priceCents ? '' : ' — REMEMBER to set a price'}`);
