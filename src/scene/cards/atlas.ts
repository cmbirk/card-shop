import * as THREE from 'three';
import type { Card, Sport } from '@shared/types';
import { CARD_SIZE } from '@shared/data/shopLayout';
import { inventory } from '../../systems/inventory';
import { drawCardFront, drawCardBack } from './cardArt';

// 2048x2048 atlases, 256x358 cells → 8x5 = 40 cards per atlas.
// 3 atlases ≈ 48MB + mips — inside the texture budget; close-up crispness
// comes from per-card detail textures created on pickup, not the atlas.
const ATLAS = 2048;
const CELL_W = 256;
const CELL_H = 358;
const COLS = Math.floor(ATLAS / CELL_W); // 8
const ROWS = Math.floor(ATLAS / CELL_H); // 5
const PER_ATLAS = COLS * ROWS; // 40

interface UVRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface CardVisual {
  frontGeometry: THREE.BufferGeometry;
  frontMaterial: THREE.MeshStandardMaterial;
  backGeometry: THREE.BufferGeometry;
  backMaterial: THREE.MeshStandardMaterial;
}

function makeCardShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** Remap ShapeGeometry's raw-coordinate UVs into [rect], optionally mirrored in U (for back faces). */
function bakeUVs(geo: THREE.BufferGeometry, w: number, h: number, rect: UVRect, mirrorU: boolean) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    let fu = pos.getX(i) / w + 0.5;
    const fv = pos.getY(i) / h + 0.5;
    if (mirrorU) fu = 1 - fu;
    uv.setXY(i, rect.u0 + fu * (rect.u1 - rect.u0), rect.v0 + fv * (rect.v1 - rect.v0));
  }
  uv.needsUpdate = true;
}

/** Foil / refractor / non-base parallel — the cards that flash when you tilt them. */
export function isRefractor(card: Card): boolean {
  return !!card.foil || (!!card.parallel && card.parallel.toLowerCase() !== 'base');
}

/** Uniforms exposed on a sweep-enabled foil material (see makeFoil). */
export interface SweepUniforms {
  uSweep: { value: number }; // 0..1 band position across the card
  uSweepStrength: { value: number };
}

/**
 * Inject a cheap view-angle rainbow + fresnel into a standard material — the foil effect.
 * With `sweep`, also adds a bright diagonal light band the frame loop can drive across the
 * face from the tilt (in-hand only); uniforms land on `material.userData.sweep`.
 */
export function makeFoil(material: THREE.MeshStandardMaterial, strength = 0.35, opts: { sweep?: boolean } = {}): THREE.MeshStandardMaterial {
  const sweep: SweepUniforms = { uSweep: { value: 0.5 }, uSweepStrength: { value: opts.sweep ? 0.32 : 0 } };
  if (opts.sweep) material.userData.sweep = sweep;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFoilStrength = { value: strength };
    shader.uniforms.uSweep = sweep.uSweep;
    shader.uniforms.uSweepStrength = sweep.uSweepStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFoilStrength;\nuniform float uSweep;\nuniform float uSweepStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 fDir = normalize( vViewPosition );
          vec3 fN = normalize( normal );
          float fAng = dot( fDir, fN );
          float fFres = pow( 1.0 - abs( fAng ), 2.0 );
          vec3 fRainbow = 0.5 + 0.5 * cos( 6.2831 * ( fAng * 2.0 + vMapUv.y * 1.5 ) + vec3( 0.0, 2.094, 4.188 ) );
          float fBand = 0.8 + 0.2 * sin( ( vMapUv.x + vMapUv.y ) * 40.0 );
          totalEmissiveRadiance += fRainbow * fFres * fBand * uFoilStrength;
          // light sweep: a soft diagonal band whose position is driven from the tilt
          float fSweepPos = vMapUv.x * 0.7 + vMapUv.y * 0.3;
          float fSweep = exp( -pow( ( fSweepPos - uSweep ) * 14.0, 2.0 ) );
          totalEmissiveRadiance += ( fRainbow * 0.6 + 0.4 ) * fSweep * uSweepStrength;
        }`,
      );
  };
  material.customProgramCacheKey = () => `foil-${strength}-${opts.sweep ? 'sweep' : 'flat'}`;
  return material;
}

function makeCanvas(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d')!;
}

function toTexture(ctx: CanvasRenderingContext2D): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(ctx.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Paint a real scan over a canvas region once it loads (contain-fit on a dark mat). */
function paintScan(url: string, ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tex: THREE.Texture) {
  const img = new Image();
  // scans in Supabase Storage are cross-origin; without this the atlas canvas is tainted and
  // WebGL refuses to upload it (SecurityError on texSubImage2D) — every card in the atlas goes blank
  img.crossOrigin = 'anonymous';
  img.onerror = () => console.warn('[atlas] scan failed to load', url);
  img.onload = () => {
    ctx.fillStyle = '#181410';
    ctx.fillRect(x, y, w, h);
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    tex.needsUpdate = true;
  };
  img.src = url;
}

let visuals: Map<string, CardVisual> | null = null;

/** Build atlases, geometries, and materials for the whole inventory. Idempotent singleton. */
export function buildCardVisuals(): Map<string, CardVisual> {
  if (visuals) return visuals;
  visuals = new Map();

  const atlasCount = Math.ceil(inventory.length / PER_ATLAS);
  const atlasTextures: THREE.CanvasTexture[] = [];
  const frontMats: THREE.MeshStandardMaterial[] = [];
  const foilMats: THREE.MeshStandardMaterial[] = [];

  const ctxs: CanvasRenderingContext2D[] = [];
  for (let a = 0; a < atlasCount; a++) ctxs.push(makeCanvas(ATLAS, ATLAS));

  // draw every card front into its atlas cell
  inventory.forEach((card, i) => {
    const a = Math.floor(i / PER_ATLAS);
    const cell = i % PER_ATLAS;
    const cx = (cell % COLS) * CELL_W;
    const cy = Math.floor(cell / COLS) * CELL_H;
    drawCardFront(ctxs[a], card, cx, cy, CELL_W, CELL_H);
  });

  for (let a = 0; a < atlasCount; a++) {
    const tex = toTexture(ctxs[a]);
    atlasTextures.push(tex);
    frontMats.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }));
    foilMats.push(makeFoil(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 })));
  }

  // real scans replace procedural art in-place once they load (procedural stays as instant fallback)
  inventory.forEach((card, i) => {
    if (!card.images?.front) return;
    const a = Math.floor(i / PER_ATLAS);
    const cell = i % PER_ATLAS;
    const cx = (cell % COLS) * CELL_W;
    const cy = Math.floor(cell / COLS) * CELL_H;
    paintScan(card.images.front, ctxs[a], cx, cy, CELL_W, CELL_H, atlasTextures[a]);
  });

  // shared per-sport backs
  const sports: Sport[] = ['baseball', 'basketball', 'football', 'hockey', 'tcg'];
  const backMats = new Map<Sport, THREE.MeshStandardMaterial>();
  const backGeos = new Map<Sport, THREE.BufferGeometry>();
  const shape = makeCardShape(CARD_SIZE.w, CARD_SIZE.h, 0.003);
  for (const sport of sports) {
    const ctx = makeCanvas(CELL_W, CELL_H);
    drawCardBack(ctx, sport, 0, 0, CELL_W, CELL_H);
    backMats.set(sport, new THREE.MeshStandardMaterial({ map: toTexture(ctx), roughness: 0.7 }));
    const geo = new THREE.ShapeGeometry(shape);
    bakeUVs(geo, CARD_SIZE.w, CARD_SIZE.h, { u0: 0, v0: 0, u1: 1, v1: 1 }, true);
    backGeos.set(sport, geo);
  }

  inventory.forEach((card, i) => {
    const a = Math.floor(i / PER_ATLAS);
    const cell = i % PER_ATLAS;
    const col = cell % COLS;
    const row = Math.floor(cell / COLS);
    // canvas y-down → texture v-up (flipY canvas textures)
    const rect: UVRect = {
      u0: (col * CELL_W) / ATLAS,
      u1: ((col + 1) * CELL_W) / ATLAS,
      v0: 1 - ((row + 1) * CELL_H) / ATLAS,
      v1: 1 - (row * CELL_H) / ATLAS,
    };
    const frontGeometry = new THREE.ShapeGeometry(shape);
    bakeUVs(frontGeometry, CARD_SIZE.w, CARD_SIZE.h, rect, false);
    visuals!.set(card.id, {
      frontGeometry,
      frontMaterial: card.foil ? foilMats[a] : frontMats[a],
      backGeometry: backGeos.get(card.sport)!,
      backMaterial: backMats.get(card.sport)!,
    });
  });

  return visuals;
}

export function getCardVisual(cardId: string): CardVisual {
  let v = buildCardVisuals().get(cardId);
  if (!v) {
    // inventory changed under us (admin save) — rebuild rather than crash the scene
    invalidateCardVisuals();
    v = buildCardVisuals().get(cardId);
  }
  if (!v) throw new Error(`no visuals for card ${cardId}`);
  return v;
}

/**
 * Drop the atlas so the next getCardVisual() rebuilds it from the current inventory.
 * Called on reloadInventory(). Old textures are disposed a beat later so meshes mid-render
 * aren't pulling the rug out from under themselves.
 */
export function invalidateCardVisuals(): void {
  const old = visuals;
  visuals = null;
  if (!old) return;
  const seen = new Set<THREE.Material>();
  setTimeout(() => {
    for (const v of old.values()) {
      for (const m of [v.frontMaterial, v.backMaterial]) {
        if (seen.has(m)) continue;
        seen.add(m);
        m.map?.dispose();
        m.dispose();
      }
    }
  }, 1000);
}

/** Hi-res single-card textures for close inspection (created on pickup, dispose after). */
export function makeDetailMaterials(card: Card): {
  front: THREE.MeshStandardMaterial;
  back: THREE.MeshStandardMaterial;
  dispose: () => void;
} {
  const fw = 512;
  const fh = 716;
  const fctx = makeCanvas(fw, fh);
  drawCardFront(fctx, card, 0, 0, fw, fh);
  const bctx = makeCanvas(fw, fh);
  drawCardBack(bctx, card.sport, 0, 0, fw, fh, card);
  const frontTex = toTexture(fctx);
  const backTex = toTexture(bctx);
  if (card.images?.front) paintScan(card.images.front, fctx, 0, 0, fw, fh, frontTex);
  if (card.images?.back) paintScan(card.images.back, bctx, 0, 0, fw, fh, backTex);
  frontTex.anisotropy = 8;
  // refractors get the real treatment in hand: clearcoat + iridescence + a tilt-driven light sweep
  const front = isRefractor(card)
    ? makeFoil(
        new THREE.MeshPhysicalMaterial({
          map: frontTex,
          roughness: 0.3,
          metalness: 0.15,
          clearcoat: 0.5,
          clearcoatRoughness: 0.3,
          iridescence: 0.18,
          iridescenceIOR: 1.3,
        }),
        0.35,
        { sweep: true },
      )
    : new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.55 });
  const back = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.7 });
  return {
    front,
    back,
    dispose: () => {
      frontTex.dispose();
      backTex.dispose();
      front.dispose();
      back.dispose();
    },
  };
}

/** Unit-UV geometry (0..1 front, mirrored back) for detail materials. */
let detailGeos: { front: THREE.BufferGeometry; back: THREE.BufferGeometry } | null = null;
export function getDetailGeometries() {
  if (!detailGeos) {
    const shape = makeCardShape(CARD_SIZE.w, CARD_SIZE.h, 0.003);
    const front = new THREE.ShapeGeometry(shape);
    bakeUVs(front, CARD_SIZE.w, CARD_SIZE.h, { u0: 0, v0: 0, u1: 1, v1: 1 }, false);
    const back = new THREE.ShapeGeometry(shape);
    bakeUVs(back, CARD_SIZE.w, CARD_SIZE.h, { u0: 0, v0: 0, u1: 1, v1: 1 }, true);
    detailGeos = { front, back };
  }
  return detailGeos;
}
