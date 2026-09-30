import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { shopLayout, ROOM, ANNEX, ANNEX_DOOR, OFFICE, BACK_OFFICE_DOOR } from '@shared/data/shopLayout';
import type { Fixture } from '@shared/types';
import { inventory, useInventoryVersion } from '../systems/inventory';
import { assignCards } from '../systems/placement';
import { MAT, makeLabelMaterial } from './materials';
import { Shelf } from './fixtures/Shelf';
import { DisplayCase } from './fixtures/DisplayCase';
import { Counter } from './fixtures/Counter';
import { Bin } from './fixtures/Bin';
import { Desk } from './fixtures/Desk';
import { useNavStore } from './../stores/navStore';
import { useInspectStore } from '../stores/inspectStore';
import { Facade } from './Facade';
import { WallArt } from './WallArt';
import { BackOfficeDoor } from './BackOfficeDoor';
import { ShowcaseRoom } from './ShowcaseRoom';
import { ShowcaseDoor } from './ShowcaseDoor';
import { LOOK } from './look';
import { InspectLight, Pendant, ShadowReceivers, SkyDome, SouthWall, Sun, SunDust, SunShafts } from './Sunlight';

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

/** Main-room west wall with an opening for the Collection doorway (plus header + trim). */
function WestWall() {
  const D = ROOM.depth;
  const H = ROOM.height;
  const x = -ROOM.width / 2;
  const z0 = ANNEX_DOOR.z - ANNEX_DOOR.width / 2;
  const z1 = ANNEX_DOOR.z + ANNEX_DOOR.width / 2;
  const northLen = z0 + D / 2; // from the north corner to the door
  const southLen = D / 2 - z1; // from the door to the south corner
  return (
    <group>
      <mesh material={MAT.wall} position={[x, H / 2, -D / 2 + northLen / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[northLen, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[x, H / 2, z1 + southLen / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[southLen, H]} />
      </mesh>
      {/* header above the opening */}
      <mesh material={MAT.wall} position={[x, (H + ANNEX_DOOR.height) / 2, ANNEX_DOOR.z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ANNEX_DOOR.width, H - ANNEX_DOOR.height]} />
      </mesh>
      {/* door casing */}
      {[z0, z1].map((z) => (
        <mesh key={z} material={MAT.dark} position={[x, ANNEX_DOOR.height / 2, z]}>
          <boxGeometry args={[0.14, ANNEX_DOOR.height, 0.08]} />
        </mesh>
      ))}
      <mesh material={MAT.dark} position={[x, ANNEX_DOOR.height + 0.04, ANNEX_DOOR.z]}>
        <boxGeometry args={[0.14, 0.08, ANNEX_DOOR.width + 0.08]} />
      </mesh>
    </group>
  );
}

/** Main-room north wall with an opening for the back-office door (the door + frame are BackOfficeDoor). */
function NorthWall() {
  const W = ROOM.width;
  const H = ROOM.height;
  const z = -ROOM.depth / 2;
  const x0 = BACK_OFFICE_DOOR.position[0] - BACK_OFFICE_DOOR.width / 2;
  const x1 = BACK_OFFICE_DOOR.position[0] + BACK_OFFICE_DOOR.width / 2;
  return (
    <group>
      <mesh material={MAT.wall} position={[(-W / 2 + x0) / 2, H / 2, z]}>
        <planeGeometry args={[x0 + W / 2, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[(x1 + W / 2) / 2, H / 2, z]}>
        <planeGeometry args={[W / 2 - x1, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[BACK_OFFICE_DOOR.position[0], (H + BACK_OFFICE_DOOR.height) / 2, z]}>
        <planeGeometry args={[BACK_OFFICE_DOOR.width, H - BACK_OFFICE_DOOR.height]} />
      </mesh>
    </group>
  );
}

/** The back office: a plain little room behind the north wall — bare bulb, boxes, filing cabinet, the desk. */
function OfficeShell() {
  const w = OFFICE.xMax - OFFICE.xMin;
  const d = OFFICE.zMax - OFFICE.zMin;
  const cx = (OFFICE.xMin + OFFICE.xMax) / 2;
  const cz = (OFFICE.zMin + OFFICE.zMax) / 2;
  const H = OFFICE.height;
  const x0 = BACK_OFFICE_DOOR.position[0] - BACK_OFFICE_DOOR.width / 2;
  const x1 = BACK_OFFICE_DOOR.position[0] + BACK_OFFICE_DOOR.width / 2;
  return (
    <group>
      <mesh material={MAT.floor} position={[cx, 0, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh material={MAT.cream} position={[cx, H, cz]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {/* far (north) wall, west, east */}
      <mesh material={MAT.wall} position={[cx, H / 2, OFFICE.zMin]}>
        <planeGeometry args={[w, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[OFFICE.xMin, H / 2, cz]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[d, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[OFFICE.xMax, H / 2, cz]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[d, H]} />
      </mesh>
      {/* south wall = the shop's north wall from behind, split around the door */}
      <mesh material={MAT.wall} position={[(OFFICE.xMin + x0) / 2, H / 2, OFFICE.zMax - 0.005]} rotation-y={Math.PI}>
        <planeGeometry args={[x0 - OFFICE.xMin, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[(x1 + OFFICE.xMax) / 2, H / 2, OFFICE.zMax - 0.005]} rotation-y={Math.PI}>
        <planeGeometry args={[OFFICE.xMax - x1, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[BACK_OFFICE_DOOR.position[0], (H + BACK_OFFICE_DOOR.height) / 2, OFFICE.zMax - 0.005]} rotation-y={Math.PI}>
        <planeGeometry args={[BACK_OFFICE_DOOR.width, H - BACK_OFFICE_DOOR.height]} />
      </mesh>
      {/* bare bulb */}
      <mesh position={[cx, H - 0.25, cz]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color={LOOK.bulbGlow} />
      </mesh>
      <mesh material={MAT.dark} position={[cx, H - 0.12, cz]}>
        <cylinderGeometry args={[0.01, 0.01, 0.24, 6]} />
      </mesh>
      <pointLight position={[cx, H - 0.3, cz]} intensity={LOOK.officeBulb.intensity} distance={LOOK.officeBulb.distance} color={LOOK.officeBulb.color} />
      {/* the desk against the far wall, facing the door */}
      <Desk position={[-3, 0, OFFICE.zMin + 0.45]} rotationY={0} />
      {/* filing cabinet + boxes */}
      <group position={[OFFICE.xMin + 0.3, 0, OFFICE.zMin + 0.35]}>
        <mesh material={MAT.dark} position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[0.45, 1.3, 0.6]} />
        </mesh>
        {[0.25, 0.65, 1.05].map((y) => (
          <mesh key={y} material={MAT.cream} position={[0, y, 0.305]}>
            <boxGeometry args={[0.36, 0.02, 0.01]} />
          </mesh>
        ))}
      </group>
      <mesh material={MAT.cardboard} position={[OFFICE.xMax - 0.5, 0.25, OFFICE.zMin + 0.6]} rotation-y={0.15} castShadow>
        <boxGeometry args={[0.6, 0.5, 0.5]} />
      </mesh>
      <mesh material={MAT.cardboard} position={[OFFICE.xMax - 0.55, 0.68, OFFICE.zMin + 0.62]} rotation-y={-0.1} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.45]} />
      </mesh>
      {/* corkboard */}
      <mesh position={[OFFICE.xMax - 0.02, 1.7, cz]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshStandardMaterial color="#b08a5a" roughness={1} />
      </mesh>
      {[['TO GRADE', -0.25, 0.12], ['SHOW SAT', 0.2, 0.05], ['CALL PSA', -0.05, -0.15]].map(([t, dz, dy]) => (
        <mesh key={t as string} material={makeLabelMaterial(t as string, { bg: '#efe6c8', fg: '#3b2a1a', size: 56 })} position={[OFFICE.xMax - 0.03, 1.7 + (dy as number), cz + (dz as number)]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.24, 0.07]} />
        </mesh>
      ))}
    </group>
  );
}

/** The Collection annex shell: floor, walls, ceiling, and a cool blue wash. Memorabilia lives in ShowcaseRoom.tsx. */
function AnnexShell() {
  // a SpotLight's target must be in the scene graph or it aims at the world origin
  const caseTarget = useMemo(() => new THREE.Object3D(), []);
  const w = ANNEX.xMax - ANNEX.xMin;
  const d = ANNEX.zMax - ANNEX.zMin;
  const cx = (ANNEX.xMin + ANNEX.xMax) / 2;
  const cz = (ANNEX.zMin + ANNEX.zMax) / 2;
  const H = ANNEX.height;
  const D = ROOM.depth;
  return (
    <group>
      <mesh material={MAT.floor} position={[cx, 0, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh material={MAT.cream} position={[cx, H, cz]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {/* west (far) wall */}
      <mesh material={MAT.wall} position={[ANNEX.xMin, H / 2, cz]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[d, H]} />
      </mesh>
      {/* north + south walls */}
      <mesh material={MAT.wall} position={[cx, H / 2, ANNEX.zMin]}>
        <planeGeometry args={[w, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[cx, H / 2, ANNEX.zMax]} rotation-y={Math.PI}>
        <planeGeometry args={[w, H]} />
      </mesh>
      {/* east wall: the main room's west wall seen from inside, plus the stretch past the main room's north corner */}
      {ANNEX.zMin < -D / 2 && (
        <mesh material={MAT.wall} position={[ANNEX.xMax, H / 2, (ANNEX.zMin + -D / 2) / 2]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[-D / 2 - ANNEX.zMin, H]} />
        </mesh>
      )}
      <mesh material={MAT.wall} position={[ANNEX.xMax - 0.005, H / 2, (-D / 2 + ANNEX_DOOR.z - ANNEX_DOOR.width / 2) / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[ANNEX_DOOR.z - ANNEX_DOOR.width / 2 + D / 2, H]} />
      </mesh>
      <mesh material={MAT.wall} position={[ANNEX.xMax - 0.005, H / 2, (ANNEX_DOOR.z + ANNEX_DOOR.width / 2 + ANNEX.zMax) / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[ANNEX.zMax - (ANNEX_DOOR.z + ANNEX_DOOR.width / 2), H]} />
      </mesh>
      {/* blue wainscot band all round — team colours without a logo */}
      {[
        { p: [ANNEX.xMin + 0.01, 0.45, cz] as const, r: Math.PI / 2, len: d },
        { p: [cx, 0.45, ANNEX.zMin + 0.01] as const, r: 0, len: w },
        { p: [cx, 0.45, ANNEX.zMax - 0.01] as const, r: Math.PI, len: w },
      ].map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1], b.p[2]]} rotation-y={b.r}>
          <planeGeometry args={[b.len, 0.9]} />
          <meshStandardMaterial color="#123a6b" roughness={0.85} />
        </mesh>
      ))}
      {/* lighting: one warm spot on the case (the room's cool fill comes from the environment) */}
      <primitive object={caseTarget} position={[-8.5, 0.8, -3.2]} />
      <spotLight target={caseTarget} position={[-7.6, 2.8, -3.2]} angle={0.62} penumbra={0.7} intensity={LOOK.annexSpot.intensity} distance={6} color={LOOK.annexSpot.color} />
    </group>
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
      {/* image-based fill (kept at its native orientation — rotated, its bright side greys out the floor's sheen) */}
      <Environment files="/hdri/artist_workshop_1k.hdr" environmentIntensity={LOOK.envIntensity} />
      {/* ambient dims while inspecting to focus the eye */}
      <ambientLight intensity={inspecting ? LOOK.ambientInspecting : LOOK.ambient} color="#fff2df" />
      {/* low afternoon sun through the south windows — the only shadow caster */}
      <Sun />
      <ShadowReceivers />
      <SkyDome />
      {/* local lights: a FIXED set (see look.ts) — counter lamp + one warm wash per shelf wall */}
      <pointLight position={[0, 2.25, -3]} intensity={LOOK.counterLamp.intensity} distance={LOOK.counterLamp.distance} color={LOOK.counterLamp.color} />
      {[-3.3, 3.3].map((x) => (
        <pointLight key={x} position={[x, 2.5, -0.3]} intensity={LOOK.wallWash.intensity} distance={LOOK.wallWash.distance} color={LOOK.wallWash.color} />
      ))}
      <InspectLight />
      <Pendant x={-1.1} z={-3} />
      <Pendant x={1.1} z={-3} />

      {/* floor */}
      <mesh material={MAT.floor} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>

      {/* walls (north wall is split around the back-office door) */}
      <NorthWall />
      {/* west wall, split around the Collection doorway */}
      <WestWall />
      <mesh material={MAT.wall} position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, H]} />
      </mesh>
      {/* south wall: real openings so the sun only gets in through the glass */}
      <SouthWall />
      {/* wainscot strips */}
      {(() => {
        const x0 = BACK_OFFICE_DOOR.position[0] - BACK_OFFICE_DOOR.width / 2;
        const x1 = BACK_OFFICE_DOOR.position[0] + BACK_OFFICE_DOOR.width / 2;
        return (
          <>
            <mesh material={MAT.wainscot} position={[(-W / 2 + x0) / 2, 0.45, -D / 2 + 0.01]}>
              <planeGeometry args={[x0 + W / 2, 0.9]} />
            </mesh>
            <mesh material={MAT.wainscot} position={[(x1 + W / 2) / 2, 0.45, -D / 2 + 0.01]}>
              <planeGeometry args={[W / 2 - x1, 0.9]} />
            </mesh>
          </>
        );
      })()}
      {(() => {
        const z0 = ANNEX_DOOR.z - ANNEX_DOOR.width / 2;
        const z1 = ANNEX_DOOR.z + ANNEX_DOOR.width / 2;
        return (
          <>
            <mesh material={MAT.wainscot} position={[-W / 2 + 0.01, 0.45, (-D / 2 + z0) / 2]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[z0 + D / 2, 0.9]} />
            </mesh>
            <mesh material={MAT.wainscot} position={[-W / 2 + 0.01, 0.45, (z1 + D / 2) / 2]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[D / 2 - z1, 0.9]} />
            </mesh>
          </>
        );
      })()}
      <mesh material={MAT.wainscot} position={[W / 2 - 0.01, 0.45, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, 0.9]} />
      </mesh>
      {/* ceiling */}
      <mesh material={MAT.cream} position={[0, H, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
      </mesh>

      {/* south windows: bright sunlit glass (HDR, so it blooms) + the closed front door */}
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x, 1.8, D / 2 - 0.02]} rotation-y={Math.PI}>
          <planeGeometry args={[2, 1.4]} />
          <meshBasicMaterial color={LOOK.windowGlow} />
        </mesh>
      ))}
      <mesh
        material={MAT.walnut}
        castShadow
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

      <AnnexShell />
      <OfficeShell />
      <ShowcaseRoom />
      <ShowcaseDoor />
      <CeilingFan />
      <SunShafts />
      <SunDust />
      <WallArt />
      <Facade />

      {/* fixtures + stock */}
      {shopLayout.fixtures.map((f) => (
        <FixtureGroup key={f.id} fixture={f}>
          {f.kind === 'shelf' && <Shelf fixture={f} cards={placed.get(f.id) ?? []} />}
          {f.kind === 'displayCase' && (
            <DisplayCase
              cards={placed.get(f.id) ?? []}
              title={f.id === 'case-collection' ? "Chris's Collection" : f.id === 'case-consign' ? 'On Consignment' : undefined}
              glassTop={f.id === 'case-premium'}
              lit={f.id === 'case-premium'}
            />
          )}
          {f.kind === 'bin' && <Bin fixtureId={f.id} cards={placed.get(f.id) ?? []} />}
          {f.kind === 'counter' && <Counter />}
        </FixtureGroup>
      ))}
    </group>
  );
}
