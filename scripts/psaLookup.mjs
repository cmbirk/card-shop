// Test harness for the PSA Public API — cert lookup + image download.
// Usage: node scripts/psaLookup.mjs <certNumber>
// Auth via .env.local: PSA_EMAIL+PSA_PASSWORD (OAuth) or PSA_API_TOKEN.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPsaToken } from './psaAuth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const cert = process.argv[2];
if (!cert) {
  console.error('Usage: node scripts/psaLookup.mjs <certNumber>');
  process.exit(1);
}
const token = getPsaToken();

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
