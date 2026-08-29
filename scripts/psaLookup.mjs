// Test harness for the PSA Public API — cert lookup + image download.
// Usage: PSA_API_TOKEN=... node scripts/psaLookup.mjs <certNumber>
//        (or put PSA_API_TOKEN in .env.local)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// minimal .env.local loader (no dependency)
if (!process.env.PSA_API_TOKEN && existsSync(join(root, '.env.local'))) {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const token = process.env.PSA_API_TOKEN;
const cert = process.argv[2];
if (!token || !cert) {
  console.error('Usage: PSA_API_TOKEN=... node scripts/psaLookup.mjs <certNumber>');
  process.exit(1);
}

const API = 'https://api.psacard.com/publicapi';
const headers = { Authorization: `bearer ${token}` };

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers });
  console.log(`GET ${path} → ${res.status}`);
  if (!res.ok) {
    console.error(await res.text());
    return null;
  }
  return res.json();
}

const certData = await get(`/cert/GetByCertNumber/${cert}`);
console.log('\n=== Cert data ===');
console.log(JSON.stringify(certData, null, 2));

const images = await get(`/cert/GetImagesByCertNumber/${cert}`);
console.log('\n=== Images ===');
console.log(JSON.stringify(images, null, 2));

// download any images found (handles both array-shaped and wrapped responses)
const list = Array.isArray(images) ? images : (images?.Images ?? images?.images ?? []);
if (Array.isArray(list) && list.length > 0) {
  const outDir = join(root, 'public/cards/psa');
  mkdirSync(outDir, { recursive: true });
  for (const img of list) {
    const url = img.ImageURL ?? img.imageUrl ?? img.url;
    if (!url) continue;
    const isFront = img.IsFrontImage ?? img.isFrontImage;
    const ext = (url.split('.').pop() ?? 'jpg').split('?')[0];
    const file = join(outDir, `psa-${cert}-${isFront ? 'f' : 'b'}.${ext}`);
    const res = await fetch(url);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`saved ${file} (${res.headers.get('content-length')} bytes)`);
  }
} else {
  console.log('No images in response.');
}
