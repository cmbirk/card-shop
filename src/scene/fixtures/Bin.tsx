import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import type { PlacedCard } from '../../systems/placement';
import { MAT, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';
import { useBinStore } from '../../stores/binStore';
import { useNavStore } from '../../stores/navStore';
import { useInspectStore } from '../../stores/inspectStore';
import { FEEL } from '../../feel';
import { sfx } from '../../systems/sfx';

const BIN_SIGN = makeLabelMaterial('Bargain Bin', { bg: '#a63d40', size: 56 });
const _target = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _hits: THREE.Intersection[] = [];
const _scale = new THREE.Vector3();
// every mounted bin's hit test, so a key press resolves to exactly one bin
const hitTests = new Map<string, () => boolean>();
/** Which bin (if any) is under the pointer right now — the riffle owns the wheel there. */
export const binUnderPointer = () => [...hitTests].find(([, over]) => over())?.[0] ?? null;
const REST = { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };

/** Can the customer thumb through bins right now? (parked at the bins, nothing in hand) */
function canRiffle(): boolean {
  const nav = useNavStore.getState();
  if (useInspectStore.getState().mode !== 'idle') return false;
  if (nav.mode === 'station') return nav.currentStation === 'bins';
  return nav.mode === 'freewalk' && nav.currentStation === 'bins'; // nearest-station tracking keeps this honest
}

/**
 * Discount bin: open box on legs holding a front-to-back stack of cards. Scroll over it to
 * riffle — cards in front flick forward, the one under your thumb stands up. Placement gives
 * each card its closed-stack rest pose; this animates offsets on top of that, refs only.
 */
export function Bin({ fixtureId, cards }: { fixtureId: string; cards: PlacedCard[] }) {
  const w = 0.22; // a long card box on legs — card-width, stack runs front to back
  const d = 0.5;
  const rim = 0.9;
  const boxH = 0.14; // shallow tray — card tops sit at the rim, like a real bin
  const { gl, camera, pointer } = useThree();
  const wrappers = useRef<(THREE.Group | null)[]>([]);
  const hitBox = useRef<THREE.Mesh>(null!);
  const n = cards.length;

  // Is the pointer over this bin's mouth? Manual raycast against an event-inert box: if the box
  // took R3F events it would be hit before the cards, bubble to FixtureGroup's stopPropagation,
  // and swallow the cards' hover/click.
  const pointerOver = () => {
    const box = hitBox.current;
    if (!box) return false;
    _ray.setFromCamera(pointer, camera);
    _hits.length = 0;
    THREE.Mesh.prototype.raycast.call(box, _ray, _hits);
    return _hits.length > 0;
  };

  // wheel: one card per FEEL.riffleWheelStep px, only while the pointer is over this bin
  useEffect(() => {
    const el = gl.domElement;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!canRiffle() || !pointerOver()) {
        acc = 0; // don't carry a sub-step into the next visit
        return;
      }
      e.preventDefault();
      acc += e.deltaY;
      const steps = Math.trunc(acc / FEEL.riffleWheelStep);
      if (steps === 0) return;
      acc -= steps * FEEL.riffleWheelStep;
      const before = useBinStore.getState().index[fixtureId] ?? 0;
      useBinStore.getState().step(fixtureId, steps, n);
      if ((useBinStore.getState().index[fixtureId] ?? 0) !== before) sfx.tick();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl, fixtureId, n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    hitTests.set(fixtureId, pointerOver);
    return () => void hitTests.delete(fixtureId);
  }, [fixtureId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: arrows / brackets step the bin under the pointer (or the last one used)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]')) return;
      const delta = e.key === 'ArrowRight' || e.key === ']' ? 1 : e.key === 'ArrowLeft' || e.key === '[' ? -1 : 0;
      if (!delta || !canRiffle()) return;
      // exactly one bin answers: the one under the pointer, else the last one used
      const b = useBinStore.getState();
      if ((binUnderPointer() ?? b.lastUsed) !== fixtureId) return;
      b.step(fixtureId, delta, n);
      sfx.tick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fixtureId, n]);

  // per-frame: damp each card toward its riffle pose (closed / flicked forward / open).
  // Offsets are in bin space, applied on an inner group under the card's static slot group.
  useFrame((_, dt) => {
    const open = n - 1 - Math.min(useBinStore.getState().index[fixtureId] ?? 0, Math.max(n - 1, 0));
    for (let i = 0; i < n; i++) {
      const g = wrappers.current[i];
      if (!g) continue;
      let y = 0;
      let z = 0;
      let rx = 0;
      let sc = 1;
      if (i > open) {
        y = -0.01;
        z = 0.1;
        rx = FEEL.riffleFlickTilt;
      } else if (i === open) {
        y = FEEL.riffleLift;
        z = 0.02;
        rx = FEEL.riffleOpenTilt;
        sc = 1.04;
      }
      _target.set(0, y, z);
      easing.damp3(g.position, _target, 1 / FEEL.riffleLambda, dt);
      easing.damp(g.rotation, 'x', cards[i].slot.rotation[0] + rx, 1 / FEEL.riffleLambda, dt);
      _scale.setScalar(sc);
      easing.damp3(g.scale, _scale, 1 / FEEL.riffleLambda, dt);
    }
  });

  const overrides = useMemo(
    () =>
      cards.map((_, i) => () => {
        const b = useBinStore.getState();
        const open = n - 1 - (b.index[fixtureId] ?? 0);
        if (i === open) return false; // the open card picks up normally
        b.set(fixtureId, n - 1 - i, n); // riffle to the card you clicked
        sfx.tick();
        return true;
      }),
    [cards, fixtureId, n],
  );

  return (
    <group>
      {/* legs */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} material={MAT.walnut} position={[(sx * (w - 0.06)) / 2, (rim - boxH) / 2, (sz * (d - 0.06)) / 2]}>
            <boxGeometry args={[0.05, rim - boxH, 0.05]} />
          </mesh>
        )),
      )}
      {/* box walls */}
      <mesh material={MAT.walnut} position={[0, rim - boxH / 2, -d / 2]}>
        <boxGeometry args={[w, boxH, 0.02]} />
      </mesh>
      <mesh material={MAT.walnut} position={[0, rim - boxH / 2, d / 2]}>
        <boxGeometry args={[w, boxH, 0.02]} />
      </mesh>
      <mesh material={MAT.walnut} position={[-w / 2, rim - boxH / 2, 0]}>
        <boxGeometry args={[0.02, boxH, d]} />
      </mesh>
      <mesh material={MAT.walnut} position={[w / 2, rim - boxH / 2, 0]}>
        <boxGeometry args={[0.02, boxH, d]} />
      </mesh>
      {/* bottom */}
      <mesh material={MAT.walnut} position={[0, rim - boxH, 0]}>
        <boxGeometry args={[w, 0.02, d]} />
      </mesh>
      {/* sign on a leg brace below the box, where there's room to read it */}
      <mesh material={MAT.walnut} position={[0, rim - boxH - 0.2, d / 2 - 0.03]}>
        <boxGeometry args={[w - 0.06, 0.02, 0.02]} />
      </mesh>
      <mesh material={BIN_SIGN} position={[0, rim - boxH - 0.32, d / 2 + 0.005]}>
        <planeGeometry args={[0.32, 0.1]} />
      </mesh>
      {/* wheel target over the mouth — raycast manually (see pointerOver); never an R3F event target */}
      <mesh ref={hitBox} position={[0, rim - boxH / 2 + 0.05, 0]} raycast={() => null}>
        <boxGeometry args={[w, boxH + 0.1, d]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {cards.map(({ card, slot }, i) => (
        <group key={card.id} position={slot.position}>
          <group
            ref={(el) => {
              wrappers.current[i] = el;
            }}
            rotation={slot.rotation}
          >
            <CardMesh card={card} slot={REST} onClickOverride={overrides[i]} />
          </group>
        </group>
      ))}
    </group>
  );
}
