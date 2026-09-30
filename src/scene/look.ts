import * as THREE from 'three';

// Every lighting / post-processing / atmosphere constant lives here — tune the shop's look from one
// file (game feel stays in feel.ts). Mood: a bright modern hobby shop — black drop ceiling full of
// recessed cans, even neutral light — with a low warm sun through the front windows as the accent.
//
// Perf note (measured on an M1 Max): each local point/spot light costs roughly 3 fps across the whole
// scene, far more than draw calls or pixels. Keep the local-light count small and FIXED — adding or
// removing a light at runtime recompiles every material (a visible hitch), so quality tiers never do.

/** Unit vector pointing FROM the scene TOWARD the sun: ~22° elevation, 25° west of due south (+Z). */
const SUN_ELEV = THREE.MathUtils.degToRad(22);
const SUN_AZ = THREE.MathUtils.degToRad(25);
export const SUN_DIR = new THREE.Vector3(
  -Math.sin(SUN_AZ) * Math.cos(SUN_ELEV),
  Math.sin(SUN_ELEV),
  Math.cos(SUN_AZ) * Math.cos(SUN_ELEV),
).normalize();

/** Linear HDR colour for emitters — values > 1 are what cross the bloom threshold. */
export function hdr(hex: string, intensity: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

export const LOOK = {
  // sun (the only shadow caster)
  sunColor: '#ffb05e',
  sunIntensity: 4.0,
  sunDistance: 14, // light sits this far along SUN_DIR from the room centre
  shadowMapSize: 2048,
  shadowRadius: 4, // PCF softening (texels)
  shadowNormalBias: 0.02,
  shadowFrustum: 12.5, // half-extent of the ortho shadow camera, metres — covers main room + annex + office
  shadowCenter: [0, 1, 0] as [number, number, number],

  // fill
  ambient: 0.32,
  ambientColor: '#f3f5f8', // neutral-cool, like 4000K LED cans
  ambientInspecting: 0.26, // the held card still has to read — dim only slightly
  envIntensity: 0.85,

  // practicals (local lights — keep the count fixed)
  counterLamp: { color: '#ffe2bd', intensity: 2.4, distance: 5 },
  wallWash: { color: '#f6f1ea', intensity: 2.2, distance: 7 },
  washes: [[-3.3, 1.9], [6.9, 4.4]] as [number, number][], // over the west-wall cabinets, over the TCG cabinet
  officeBulb: { color: '#fff0d0', intensity: 1.6, distance: 6 },
  caseLight: { color: '#ffd9a0', intensity: 2.2, distance: 1.8 }, // The Good Stuff only — graded cards must read
  // neutral key that rides with the camera and fades up while a card is held, so card art reads true
  // in any corner of the warm shop. Always in the scene (fixed light count); only its intensity moves.
  inspectLight: { color: '#fff6ea', intensity: 1.6, distance: 1.6, offset: [-0.25, 0.3, 0.1] as [number, number, number], lambda: 6 },
  annexSpot: { color: '#ffe3b0', intensity: 7 },

  // Loki is a black dog: without help he reads as a silhouette in the warm low light. A soft fur
  // sheen + extra environment reflection keeps his shape and coat detail visible.
  lokiCoat: { sheen: 0.8, sheenColor: '#b9a58c', sheenRoughness: 0.55, envBoost: 1.8 },

  // ceiling (emitters only — the cans are not lights)
  canSpacing: 1.6, // metres between recessed cans
  canGlow: hdr('#fff6ec', 7),
  panelGlow: hdr('#f4f7fb', 1.6),
  troffers: [[0.2, 3.2], [0.2, -0.8], [3.8, 3.2]] as [number, number][],

  // emitters (bloom sources)
  windowGlow: hdr('#ffe7c2', 2.6),
  bulbGlow: hdr('#ffd9a0', 6),
  ledStrip: hdr('#ffe9cc', 3.2),

  // sun shafts + dust
  beamColor: new THREE.Color('#ffd49a'),
  beamOpacity: 0.04,
  beamLength: 7.5, // metres along the light's travel
  dustCount: 320,
  dustSize: 0.014,
  dustOpacity: 0.55,

  // atmosphere
  sky: { top: '#9fb8cf', horizon: '#f3d3a4' },
  fog: { color: '#e9cfa6', near: 16, far: 45 },

  // post
  perfArmDelayMs: 6000, // quality monitor starts this long after loading settles
  exposure: 1.0,
  bloom: { threshold: 0.82, smoothing: 0.25, intensity: 0.55 },
  ao: { radius: 0.5, distanceFalloff: 0.35, intensity: 2.2 },
  vignette: { offset: 0.28, darkness: 0.5 },
  grain: 0.035,
} as const;
