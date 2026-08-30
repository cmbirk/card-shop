// Cheap pre-flight checks before a photo costs a Ximilar credit: resolution floor,
// exposure (histogram mean), and blur (Laplacian variance on a 256px downsample).
// Anything subtler is Ximilar's job — its response drives the retry loop.

export type GateResult = 'ok' | 'too_small' | 'too_dark' | 'too_bright' | 'blurry';

export async function checkPhoto(file: File): Promise<GateResult> {
  const bmp = await createImageBitmap(file);
  try {
    if (Math.min(bmp.width, bmp.height) < 500) return 'too_small';
    const N = 256;
    const s = N / Math.max(bmp.width, bmp.height);
    const w = Math.max(8, Math.round(bmp.width * s));
    const h = Math.max(8, Math.round(bmp.height * s));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const g = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      g[i] = v;
      sum += v;
    }
    const mean = sum / (w * h);
    if (mean < 40) return 'too_dark';
    if (mean > 215) return 'too_bright';
    // Laplacian variance (4-neighbour)
    let lSum = 0;
    let lSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
        lSum += v;
        lSq += v * v;
        n++;
      }
    const variance = lSq / n - (lSum / n) ** 2;
    if (variance < 55) return 'blurry';
    return 'ok';
  } finally {
    bmp.close();
  }
}
