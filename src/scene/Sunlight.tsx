import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useInspectStore } from '../stores/inspectStore';
import * as THREE from 'three';
import { ROOM } from '@shared/data/shopLayout';
import { MAT, dropCeilingMat } from './materials';
import { metreBox } from './geo';
import { LOOK, SUN_DIR } from './look';

// The golden-afternoon rig: a low sun outside the south wall, real window openings so it lands as
// window-grid patches on the floor, fake volumetric shafts, and dust that only shows inside the beam.

/** South-wall openings (interior face at z = ROOM.depth/2). The door is closed, so it's not an opening. */
export const SOUTH_WINDOWS = [-3, 3].map((x) => ({ x0: x - 1, x1: x + 1, y0: 1.1, y1: 2.5 }));
const DOOR = { x0: -0.55, x1: 0.55, y1: 2.2 };
const WALL_T = 0.015; // thin enough to stay behind the facade plane (z = D/2 + 0.02)

const TRAVEL = SUN_DIR.clone().negate(); // direction the light travels (into the room)

export function Sun() {
  const target = useMemo(() => new THREE.Object3D(), []);
  const pos = useMemo(
    () => SUN_DIR.clone().multiplyScalar(LOOK.sunDistance).add(new THREE.Vector3(...LOOK.shadowCenter)).toArray(),
    [],
  );
  const f = LOOK.shadowFrustum;
  return (
    <>
      <primitive object={target} position={LOOK.shadowCenter} />
      <directionalLight
        target={target}
        position={pos}
        intensity={LOOK.sunIntensity}
        color={LOOK.sunColor}
        castShadow
        shadow-mapSize={[LOOK.shadowMapSize, LOOK.shadowMapSize]}
        shadow-radius={LOOK.shadowRadius}
        shadow-normalBias={LOOK.shadowNormalBias}
        shadow-camera-left={-f}
        shadow-camera-right={f}
        shadow-camera-top={f}
        shadow-camera-bottom={-f}
        shadow-camera-near={1}
        shadow-camera-far={LOOK.sunDistance + 12}
      />
    </>
  );
}

// the room shell must block the sun everywhere except the glass: walls and ceilings cast
const SHELL = new Set<THREE.Material>([MAT.wall, MAT.wainscot, MAT.cream, MAT.barnwood, dropCeilingMat]);

/** Every lit mesh receives the sun's shadow and every wall/ceiling casts one (both are per-object flags,
 *  not shader variants — no recompiles). Meshes mount late (GLB characters, re-placed cards), so
 *  re-sweep about once a second. */
export function ShadowReceivers() {
  const scene = useThree((s) => s.scene);
  const frame = useRef(0);
  useFrame(() => {
    if (frame.current++ % 60 !== 0) return;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      if (SHELL.has(mat)) m.castShadow = true;
      if (m.receiveShadow) return;
      if (!mat || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || mat.transparent) return;
      m.receiveShadow = true;
    });
  });
  return null;
}

/** The south wall as real segments around the windows, so the sun only gets in where the glass is. */
export function SouthWall() {
  // built once: one metre-UV box per wall piece (barn wood lines up across segments)
  const pieces = useMemo(() => {
    const W = ROOM.width;
    const H = ROOM.height;
    const z = ROOM.depth / 2 + WALL_T / 2;
    // columns across the wall: [x0, x1, open-from-y, open-to-y] (open span has wall below and above)
    const xs = [...new Set([-W / 2, ...SOUTH_WINDOWS.flatMap((w) => [w.x0, w.x1]), DOOR.x0, DOOR.x1, W / 2])].sort((a, b) => a - b);
    const out: { key: string; pos: [number, number, number]; geo: THREE.BufferGeometry }[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i];
      const b = xs[i + 1];
      const mid = (a + b) / 2;
      const win = SOUTH_WINDOWS.find((w) => mid > w.x0 && mid < w.x1);
      const door = mid > DOOR.x0 && mid < DOOR.x1;
      const [o0, o1] = win ? [win.y0, win.y1] : door ? [0, DOOR.y1] : [H, H];
      const spans: [number, number][] = [];
      if (o0 > 0) spans.push([0, o0]);
      if (o1 < H) spans.push([o1, H]);
      for (const [y0, y1] of spans) {
        const pos: [number, number, number] = [mid, (y0 + y1) / 2, z];
        out.push({ key: `${a}-${y0}`, pos, geo: metreBox(b - a, y1 - y0, WALL_T, 1.4, pos) });
      }
    }
    return out;
  }, []);
  useEffect(() => () => pieces.forEach((p) => p.geo.dispose()), [pieces]);
  return (
    <group>
      {pieces.map((p) => (
        <mesh key={p.key} material={MAT.barnwood} position={p.pos} geometry={p.geo} castShadow />
      ))}
      {SOUTH_WINDOWS.map((w) => (
        <WindowGrid key={w.x0} {...w} />
      ))}
    </group>
  );
}

/** Frame + muntins: four panes, and the cross that turns the sun patch into a window shape. */
function WindowGrid({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  const z = ROOM.depth / 2 - 0.03;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const w = x1 - x0;
  const h = y1 - y0;
  const bar = 0.045;
  const frame = 0.07;
  const bars: [number, number, number, number][] = [
    [cx, cy, bar, h], // vertical muntin
    [cx, cy, w, bar], // horizontal muntin
    [cx, y0 + frame / 2, w + frame, frame], // sill
    [cx, y1 - frame / 2, w + frame, frame], // head
    [x0 + frame / 2, cy, frame, h], // jambs
    [x1 - frame / 2, cy, frame, h],
  ];
  return (
    <group>
      {bars.map(([x, y, bw, bh], i) => (
        <mesh key={i} material={MAT.green} position={[x, y, z]} castShadow raycast={() => null}>
          <boxGeometry args={[bw, bh, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

const shaftVert = /* glsl */ `
  attribute vec2 aUV;
  varying vec2 vUV;
  void main() {
    vUV = aUV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const shaftFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUV; // x: across the sheet, y: along the beam (0 at the glass)
  void main() {
    float across = smoothstep(0.0, 0.3, vUV.x) * smoothstep(1.0, 0.7, vUV.x);
    float along = smoothstep(0.0, 0.06, vUV.y) * pow(1.0 - vUV.y, 1.7);
    gl_FragColor = vec4(uColor * uOpacity * across * along, 1.0);
  }
`;

/** Fake volumetric light: soft additive sheets swept from each window along the sun's travel. */
export function SunShafts() {
  const { geometry, material } = useMemo(() => {
    const pos: number[] = [];
    const uv: number[] = [];
    const z = ROOM.depth / 2;
    const L = TRAVEL.clone().multiplyScalar(LOOK.beamLength);
    const quad = (a: THREE.Vector3, b: THREE.Vector3) => {
      // a→b spans the window edge; both ends swept along the beam
      const c = b.clone().add(L);
      const d = a.clone().add(L);
      pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    };
    for (const w of SOUTH_WINDOWS) {
      const v = (x: number, y: number) => new THREE.Vector3(x, y, z);
      const cy = (w.y0 + w.y1) / 2;
      const cx = (w.x0 + w.x1) / 2;
      quad(v(w.x0, w.y0), v(w.x1, w.y0)); // floor-side sheet
      quad(v(w.x0, w.y1), v(w.x1, w.y1)); // ceiling-side sheet
      quad(v(w.x0, w.y0), v(w.x0, w.y1)); // side sheets
      quad(v(w.x1, w.y0), v(w.x1, w.y1));
      quad(v(w.x0, cy), v(w.x1, cy)); // two inner sheets fill the middle of the beam
      quad(v(cx, w.y0), v(cx, w.y1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.ShaderMaterial({
      vertexShader: shaftVert,
      fragmentShader: shaftFrag,
      uniforms: { uColor: { value: LOOK.beamColor }, uOpacity: { value: LOOK.beamOpacity } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return { geometry: g, material: m };
  }, []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh geometry={geometry} material={material} raycast={() => null} frustumCulled={false} renderOrder={2} />;
}

const dustMat = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: LOOK.beamColor.clone().multiplyScalar(2.2) },
    uOpacity: { value: LOOK.dustOpacity },
    uSize: { value: LOOK.dustSize },
    uScale: { value: 800 }, // drawing-buffer height in device px (set from the canvas size — see SunDust)
    uMaxPx: { value: 5 }, // cap in device px (scaled by DPR in SunDust)
  },
  vertexShader: /* glsl */ `
    uniform float uSize;
    uniform float uScale;
    uniform float uMaxPx;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      // perspective size, capped so motes near the lens stay specks, not squares
      gl_PointSize = min(uSize * uScale / -mv.z, uMaxPx);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.0, d);
      gl_FragColor = vec4(uColor * uOpacity * a * a, 1.0);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

/** Dust drifting inside the beams — invisible elsewhere, which is exactly how real dust reads. */
export function SunDust() {
  const ref = useRef<THREE.Points>(null!);
  const seeds = useMemo(() => {
    const n = LOOK.dustCount;
    const s = new Float32Array(n * 4); // window index, u, v, w (across, up, along the beam)
    for (let i = 0; i < n; i++) {
      s[i * 4] = i % SOUTH_WINDOWS.length;
      s[i * 4 + 1] = Math.random();
      s[i * 4 + 2] = Math.random();
      s[i * 4 + 3] = Math.pow(Math.random(), 1.4) * 0.8; // denser near the glass
    }
    return s;
  }, []);
  const positions = useMemo(() => new Float32Array(LOOK.dustCount * 3), []);
  // gl_PointSize is in device pixels: keep motes the same apparent size across DPR changes
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  useEffect(() => {
    dustMat.uniforms.uScale.value = height * dpr;
    dustMat.uniforms.uMaxPx.value = 2.5 * dpr;
  }, [height, dpr]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const arr = (ref.current.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const z = ROOM.depth / 2;
    for (let i = 0; i < LOOK.dustCount; i++) {
      const w = SOUTH_WINDOWS[seeds[i * 4]];
      const u = seeds[i * 4 + 1] + Math.sin(t * 0.13 + i) * 0.04;
      const v = (seeds[i * 4 + 2] + t * 0.006 * (1 + (i % 5))) % 1; // slow rise, wraps
      const along = seeds[i * 4 + 3] * LOOK.beamLength + Math.sin(t * 0.09 + i * 1.7) * 0.05;
      arr[i * 3] = w.x0 + u * (w.x1 - w.x0) + TRAVEL.x * along;
      arr[i * 3 + 1] = w.y0 + v * (w.y1 - w.y0) + TRAVEL.y * along;
      arr[i * 3 + 2] = z + TRAVEL.z * along;
    }
    ref.current.geometry.getAttribute('position').needsUpdate = true;
  });
  return (
    <points ref={ref} raycast={() => null} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <primitive object={dustMat} attach="material" />
    </points>
  );
}

const shadeGeo = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.02, 0.12),
    new THREE.Vector2(0.05, 0.11),
    new THREE.Vector2(0.09, 0.06),
    new THREE.Vector2(0.15, 0.0),
    new THREE.Vector2(0.17, -0.02),
  ],
  24,
);
const shadeMat = new THREE.MeshStandardMaterial({ color: '#2e4a3e', roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
const bulbMat = new THREE.MeshBasicMaterial({ color: LOOK.bulbGlow });

/** Enamel pendant lamp hanging from the ceiling — a visible source (and bloom) for the counter light. */
export function Pendant({ x, z, drop = 0.7 }: { x: number; z: number; drop?: number }) {
  const H = ROOM.height;
  return (
    <group position={[x, H - drop, z]}>
      <mesh material={MAT.dark} position={[0, drop / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
      </mesh>
      <mesh geometry={shadeGeo} material={shadeMat} castShadow raycast={() => null} />
      <mesh material={bulbMat} position={[0, 0.0, 0]} raycast={() => null}>
        <sphereGeometry args={[0.045, 16, 12]} />
      </mesh>
    </group>
  );
}

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
    col += uSun * pow(max(dot(normalize(vDir), uSunDir), 0.0), 24.0); // warm glow around the sun
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Afternoon sky: a gradient dome (only seen from outside, above the facade) with a glow where the sun is. */
export function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        uniforms: {
          uTop: { value: new THREE.Color(LOOK.sky.top) },
          uHorizon: { value: new THREE.Color(LOOK.sky.horizon) },
          uSun: { value: new THREE.Color(LOOK.sunColor).multiplyScalar(0.6) },
          uSunDir: { value: SUN_DIR },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} raycast={() => null} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[40, 32, 16]} />
    </mesh>
  );
}

const _off = new THREE.Vector3();

/** Card key light: follows the camera, up and to the left, and fades in while inspecting. */
export function InspectLight() {
  const ref = useRef<THREE.PointLight>(null!);
  useFrame(({ camera }, dt) => {
    const l = ref.current;
    const c = LOOK.inspectLight;
    _off.set(c.offset[0], c.offset[1], c.offset[2]).applyQuaternion(camera.quaternion);
    l.position.copy(camera.position).add(_off);
    const want = useInspectStore.getState().mode !== 'idle' ? c.intensity : 0;
    l.intensity = THREE.MathUtils.damp(l.intensity, want, c.lambda, dt);
  });
  return (
    <pointLight
      ref={ref}
      intensity={0}
      distance={LOOK.inspectLight.distance}
      color={LOOK.inspectLight.color}
    />
  );
}
