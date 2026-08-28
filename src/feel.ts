// Every game-feel constant lives here — tune the whole shop from one file.

export const FEEL = {
  // camera
  glideSmoothTime: 0.55, // camera-controls damp, ~1s felt time cross-shop
  hopSmoothTime: 0.4, // midpoint hop segments

  // card motion
  hoverLambda: 20, // exp damp — ~120ms feel
  hoverScale: 1.06,
  hoverLift: 0.008,
  pickupDuration: 0.45,
  pickupOvershoot: 1.2, // easeOutBack s
  pickupArcHeight: 0.08,
  flipDuration: 0.4,
  flipPullback: 0.05,
  returnDuration: 0.35,
  toBasketDuration: 0.5,
  dragLambda: 12,
  inspectDistance: 0.38,
  inspectMinDistance: 0.22,
  inspectMaxDistance: 0.5,
  detailTextureAt: 0.3, // swap to hi-res closer than this

  // basket
  basketLambda: 8,
  basketAnchor: [0.24, -0.22, -0.75] as const,
  basketScale: 0.5,

  // shopkeeper
  headLookLambda: 6,

  // checkout
  counterFlyStagger: 0.08,
} as const;

export function easeOutBack(t: number, s = FEEL.pickupOvershoot): number {
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
