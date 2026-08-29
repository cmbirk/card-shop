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

  // refractor sheen (in hand)
  sheenSweepScale: 1.6, // how fast the light band crosses the card per radian of tilt
  shimmerVelocity: 2.5, // rad/s of tilt before the shimmer sound can fire
  shimmerCooldown: 0.35, // s between shimmers

  // bargain-bin riffle
  riffleLambda: 14,
  riffleLift: 0.07, // the open card stands up out of the stack
  riffleOpenTilt: (22 * Math.PI) / 180, // toward the customer
  riffleFlickTilt: (-45 * Math.PI) / 180, // flicked-forward cards lie against the front wall
  riffleWheelStep: 40, // px of wheel per card (trackpads)

  // basket
  basketLambda: 8,
  basketAnchor: [0.24, -0.22, -0.75] as const,
  basketScale: 0.5,

  // shopkeeper
  headLookLambda: 6,
  shopkeeperWalkSpeed: 1.15, // m/s, walking out to a customer and back
  shopkeeperTurnLambda: 8, // yaw damp toward travel direction / the customer
  bubbleHoldPerWord: 0.35, // s of reading time per word once a line finishes
  bubbleHoldMin: 3,
  bubbleHoldMax: 12,
  mayaLineHold: 6, // s Maya's canned line stays up

  // checkout
  counterFlyStagger: 0.08,
} as const;

/** How long a spoken line stays on screen after it finishes, from its length. */
export function bubbleHoldSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(FEEL.bubbleHoldMax, Math.max(FEEL.bubbleHoldMin, words * FEEL.bubbleHoldPerWord));
}

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
