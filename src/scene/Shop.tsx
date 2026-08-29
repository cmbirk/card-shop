import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { shopLayout, ROOM } from '@shared/data/shopLayout';
import type { Fixture } from '@shared/types';
import { inventory, useInventoryVersion } from '../systems/inventory';
import { assignCards } from '../systems/placement';
import { MAT, makeLabelMaterial } from './materials';
import { Shelf } from './fixtures/Shelf';
import { DisplayCase } from './fixtures/DisplayCase';
import { Counter } from './fixtures/Counter';
import { Bin } from './fixtures/Bin';
import { useNavStore } from './../stores/navStore';
import { useInspectStore } from '../stores/inspectStore';
import { Facade } from './Facade';
import { WallArt } from './WallArt';
import { BackOfficeDoor } from './BackOfficeDoor';

function FixtureGroup({ fixture, children }: { fixture: Fixture; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  return (
    <group
      position={fixture.position}
      rotation-y={fixture.rotationY}
      onClick={(e) => {
        if (useNavStore.getState().currentStation === 'outside') return;
        e.stopPropagation();
        useNavStore.getState().goTo(fixture.stationId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        const nav = useNavStore.getState();
        if (nav.mode === 'station' && nav.currentStation !== 'outside') setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
    </group>
  );
}

function CeilingFan() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 1.2;
  });
  return (
    <group position={[0, ROOM.height - 0.25, 0]}>
      <mesh material={MAT.dark}>
        <cylinderGeometry args={[0.06, 0.06, 0.3]} />
      </mesh>
      <group ref={ref} position-y={-0.12}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={MAT.walnut} rotation-y={(i * Math.PI) / 2} position-x={0}>
            <boxGeometry args={[1.2, 0.02, 0.14]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DustMotes() {
  const ref = useRef<THREE.Points>(null!);
  const { positions, speeds } = useMemo(() => {
    const n = 100;
    const positions = new Float32Array(n * 3);
    const speeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 1] = 0.3 + Math.random() * 2.2;
      positions[i * 3 + 2] = 1 + Math.random() * 2.6;
      speeds[i] = 0.02 + Math.random() * 0.05;
    }
    return { positions, speeds };
  }, []);
  useFrame((state) => {
    const pos = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < speeds.length; i++) {
      pos.array[i * 3 + 1] = 0.3 + ((positions[i * 3 + 1] - 0.3 + t * speeds[i]) % 2.2);
      pos.array[i * 3] = positions[i * 3] + Math.sin(t * 0.3 + i) * 0.08;
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.slice(), 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.012} color="#ffe9c4" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Pennant({ x, z, hue, rot }: { x: number; z: number; hue: number; rot: number }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: `hsl(${hue}, 55%, 45%)`, side: THREE.DoubleSide, roughness: 0.9 }),
    [hue],
  );
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.12);
    shape.lineTo(0, -0.12);
    shape.lineTo(0.6, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  return <mesh geometry={geo} material={mat} position={[x, 2.5, z]} rotation-y={rot} />;
}

export function Shop() {
  const invVersion = useInventoryVersion((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placed = useMemo(() => assignCards(inventory, shopLayout), [invVersion]);
  const inspecting = useInspectStore((s) => s.mode !== 'idle');

  const W = ROOM.width;
  const D = ROOM.depth;
  const H = ROOM.height;

  return (
    <group>
      {/* image-based lighting — most of the material realism comes from this */}
      <Environment files="/hdri/artist_workshop_1k.hdr" environmentIntensity={0.55} />
      {/* ambient dims while inspecting to focus the eye */}
      <ambientLight intensity={inspecting ? 0.12 : 0.2} color="#fff2df" />
      {/* warm key from the south windows — the only shadow caster */}
      <directionalLight
        position={[2.5, 2.6, 5]}
        intensity={1.1}
        color="#ffd9a0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.02}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
      />
      {/* counter lamp */}
      <pointLight position={[0, 2.4, -3]} intensity={1.4} distance={4} color="#ffd9a0" />
      {/* central fill over the bins/aisle */}
      <pointLight position={[0, 2.5, 0.6]} intensity={1.0} distance={5} color="#fff0d8" />

      {/* floor */}
      <mesh material={MAT.floor} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <ContactShadows position={[0, 0.005, 0]} scale={12} far={2} blur={2.5} opacity={0.35} frames={1} />

      {/* walls */}
      <mesh material={MAT.wall} position={[0, H / 2, -D / 2]}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[-W / 2, H / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[0, H / 2, D / 2]} rotation-y={Math.PI}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* wainscot strips */}
      <mesh material={MAT.wainscot} position={[0, 0.45, -D / 2 + 0.01]}>
        <planeGeometry args={[W, 0.9]} />
      </mesh>
      <mesh material={MAT.wainscot} position={[-W / 2 + 0.01, 0.45, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[D, 0.9]} />
      </mesh>
      <mesh material={MAT.wainscot} position={[W / 2 - 0.01, 0.45, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, 0.9]} />
      </mesh>
      {/* ceiling */}
      <mesh material={MAT.cream} position={[0, H, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
      </mesh>

      {/* south windows (glowing planes) + door */}
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x, 1.8, D / 2 - 0.02]} rotation-y={Math.PI}>
          <planeGeometry args={[2, 1.4]} />
          <meshBasicMaterial color="#ffe9c4" />
        </mesh>
      ))}
      <mesh
        material={MAT.walnut}
        position={[0, 1.1, D / 2 - 0.02]}
        rotation-y={Math.PI}
        onClick={(e) => {
          const nav = useNavStore.getState();
          if (nav.currentStation === 'outside') return;
          e.stopPropagation();
          nav.goTo('outside');
        }}
      >
        <planeGeometry args={[1.1, 2.2]} />
      </mesh>
      <mesh material={makeLabelMaterial('Thanks! Come again', { bg: '#efe6c8', fg: '#3b2a1a', size: 40 })} position={[0, 1.9, D / 2 - 0.04]} rotation-y={Math.PI}>
        <planeGeometry args={[0.6, 0.16]} />
      </mesh>

      {/* staff-only door to the back office */}
      <BackOfficeDoor />

      {/* entry rug */}
      <mesh material={MAT.green} position={[0, 0.012, 3.4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.6, 1]} />
      </mesh>

      {/* wall clock */}
      <group position={[0, 2.5, -D / 2 + 0.03]}>
        <mesh material={MAT.cream}>
          <circleGeometry args={[0.2, 24]} />
        </mesh>
        <mesh material={MAT.dark} position-z={0.005}>
          <boxGeometry args={[0.02, 0.14, 0.005]} />
        </mesh>
      </group>

      {/* pennants on the back wall */}
      <Pennant x={-3.5} z={-D / 2 + 0.03} hue={215} rot={0} />
      <Pennant x={-2.6} z={-D / 2 + 0.03} hue={20} rot={0} />
      <Pennant x={2.2} z={-D / 2 + 0.03} hue={140} rot={0} />
      <Pennant x={3.1} z={-D / 2 + 0.03} hue={275} rot={0} />

      {/* boxes behind the counter */}
      <mesh material={MAT.cardboard} position={[-2, 0.2, -3.6]} castShadow>
        <boxGeometry args={[0.5, 0.4, 0.4]} />
      </mesh>
      <mesh material={MAT.cardboard} position={[-2.05, 0.55, -3.62]} rotation-y={0.2} castShadow>
        <boxGeometry args={[0.4, 0.3, 0.35]} />
      </mesh>

      <CeilingFan />
      <DustMotes />
      <WallArt />
      <Facade />

      {/* fixtures + stock */}
      {shopLayout.fixtures.map((f) => (
        <FixtureGroup key={f.id} fixture={f}>
          {f.kind === 'shelf' && <Shelf fixture={f} cards={placed.get(f.id) ?? []} />}
          {f.kind === 'displayCase' && <DisplayCase cards={placed.get(f.id) ?? []} />}
          {f.kind === 'bin' && <Bin fixtureId={f.id} cards={placed.get(f.id) ?? []} />}
          {f.kind === 'counter' && <Counter />}
        </FixtureGroup>
      ))}
    </group>
  );
}
