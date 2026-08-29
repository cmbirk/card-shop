// TAG Grading cert ingestion. TAG's DIG reports are public share pages
// (my.taggrading.com/card/<cert>) whose detail JSON is obfuscated but whose
// card scans sit on a public CloudFront CDN. We load the public page in
// headless Chromium (the share link TAG intends anyone to open), read the
// rendered card details, and download the clean FRONT_MAIN / BACK_MAIN scans.
//
// Usage: node scripts/addTagCard.mjs <cert> [priceCents] [--featured]
//   cert format: 1 letter + 7 digits (e.g. H1761453)
// Requires playwright + a chromium install (npx playwright install chromium).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const cert = (process.argv[2] ?? '').toUpperCase();
const priceCents = Number(process.argv[3]) || 0;
const featured = process.argv.includes('--featured');
if (!/^[A-Z]\d{7}$/.test(cert)) {
  console.error('Usage: node scripts/addTagCard.mjs <cert:L+7digits> [priceCents] [--featured]');
  process.exit(1);
}

function mapSport(text) {
  const t = text.toLowerCase();
  if (t.includes('baseball')) return 'baseball';
  if (t.includes('basketball')) return 'basketball';
  if (t.includes('football')) return 'football';
  if (t.includes('hockey')) return 'hockey';
  if (/pok[eé]mon|magic|yu-?gi|one piece|digimon|lorcana|weiss|dragon ball/i.test(text)) return 'tcg';
  return 'tcg';
}

const browser = await chromium.launch();
const page = await browser.newPage();
const imageUrls = new Set();
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/card-images/') && /_(FRONT|BACK)_MAIN\.jpg/i.test(u)) imageUrls.add(u.split('?')[0]);
});

console.log(`Loading DIG report for ${cert}…`);
await page.goto(`https://my.taggrading.com/card/${cert}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);

// pull structured bits out of the rendered report
const data = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].map((e) => e.src).filter((s) => s.includes('/card-images/'));
  return { text: document.body.innerText, imgs };
});
for (const u of data.imgs) imageUrls.add(u.split('?')[0]);
// every scan for a card shares one CDN UUID — derive clean front+back from it
const uuidMatch = [...imageUrls].map((u) => u.match(/card-images\/([0-9a-f-]{36})_/i)).find(Boolean);
const sides = new Map(); // 'f'|'b' -> url
if (uuidMatch) {
  const base = `https://d39lwrz0lm7c9r.cloudfront.net/card-images/${uuidMatch[1]}`;
  sides.set('f', `${base}_FRONT_MAIN.jpg`);
  sides.set('b', `${base}_BACK_MAIN.jpg`);
}

const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);
if (!lines.some((l) => l.includes(`#${cert}`) || l.includes(cert))) {
  console.error('Could not find this cert on the page — is the number correct / the card public?');
  await browser.close();
  process.exit(1);
}

// The report header is: <subject> / <year set #num> / <set variant> / <rarity> / <specId> / TAG SCORE / <score> / <grade word>
const subject = lines.find((l) => /[A-Z]/.test(l) && !/^(HOME|ABOUT|GRADING|POP REPORT|SHOP|COMMUNITY|HELP|SUBMIT)$/.test(l)) ?? 'Unknown';
const setLine = lines[lines.indexOf(subject) + 1] ?? '';
const yearMatch = setLine.match(/(\d{4})/);
const numMatch = setLine.match(/#([\w/]+)/);
// score label varies ("TAG SCORE" / "VIEW SCORE"); grade word (PRISTINE, GEM MINT…) follows if present
const gradeIdx = lines.findIndex((l) => /SCORE$/.test(l));
const scoreVal = gradeIdx >= 0 ? Number(lines[gradeIdx + 1]) : 0;
const nextLine = gradeIdx >= 0 ? lines[gradeIdx + 2] : '';
const gradeWord = /^[A-Z][A-Z ]+$/.test(nextLine) && !/%|FRONT|BACK|CERT/.test(nextLine) ? nextLine : '';

// download scans
const outDir = join(root, 'public/cards/tag');
mkdirSync(outDir, { recursive: true });
const images = {};
for (const [side, url] of sides) {
  const res = await fetch(url);
  if (!res.ok) continue;
  const file = `tag-${cert.toLowerCase()}-${side}.jpg`;
  const path = join(outDir, file);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  // TAG originals are ~6MB/4000px — downsize for the web (sips ships with macOS)
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '--resampleHeight', '1400', path, '--out', path], { stdio: 'ignore' });
  } catch {}
  images[side === 'f' ? 'front' : 'back'] = `/cards/tag/${file}`;
  console.log(`saved ${file}`);
}
await browser.close();

const card = {
  id: `tag-${cert.toLowerCase()}`,
  sport: mapSport(setLine + ' ' + subject),
  category: 'graded-slabs',
  // strip a leading non-Latin (e.g. Japanese) duplicate of the name, keep the Latin form
  playerName: subject.replace(/^[^\x00-\x7F]+\s*/, '').replace(/\s+/g, ' ').trim() || subject.trim(),
  team: '',
  year: yearMatch ? Number(yearMatch[1]) : 0,
  setName: setLine.replace(/\d{4}/, '').replace(/#[\w/]+/, '').replace(/\s+/g, ' ').trim(),
  cardNumber: numMatch ? `#${numMatch[1]}` : '',
  rarity: 'graded',
  grade: { company: 'TAG', value: scoreVal, label: `TAG ${scoreVal} ${gradeWord}`.trim(), certNumber: cert },
  price: priceCents,
  seed: [...cert].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7),
  featured,
  ...(Object.keys(images).length ? { images } : {}),
  lore: {
    blurb: `${yearMatch?.[1] ?? ''} ${subject}, TAG-graded ${scoreVal}${gradeWord ? ` (${gradeWord})` : ''} with a full Digital Image & Grading report.`.trim(),
    funFact: `Verify the DIG report at my.taggrading.com/card/${cert}.`,
  },
};

const p = join(root, 'shared/data/realCards.json');
const db = JSON.parse(readFileSync(p, 'utf8'));
const idx = db.cards.findIndex((c) => c.grade?.certNumber === cert);
if (idx >= 0) db.cards[idx] = { ...db.cards[idx], ...card };
else db.cards.push(card);
writeFileSync(p, JSON.stringify(db, null, 2) + '\n');
console.log(`\n${idx >= 0 ? 'Updated' : 'Added'} ${card.id}: ${card.playerName} — ${card.grade.label}${priceCents ? '' : '  (set a price!)'}`);
console.log(JSON.stringify(card, null, 2));
