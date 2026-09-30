import type { PlacedCard } from '../../systems/placement';
import { MAT, ledStripMat, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';
import { LOOK } from '../look';

/** Low glass showcase: light-grey laminate base with a dark kick, glass box on top with a glass lid in an
 *  aluminium rim, a dark felt riser for the back row, LED strips inside. Glass is raycast-transparent
 *  so clicks reach the cards. */
export function DisplayCase({
  cards,
  title = 'The Good Stuff',
  lit = false,
  children,
}: {
  cards: PlacedCard[];
  /** sign over the case; null = no sign (decorative cases in the showcase run) */
  title?: string | null;
  children?: React.ReactNode;
  /** give the case its own interior light (a fixed local light — see look.ts before adding more) */
  lit?: boolean;
}) {
  const noHit = () => null;
  return (
    <group>
      {/* base + kick */}
      <mesh material={MAT.laminate} position={[0, 0.27, 0]} castShadow>
        <boxGeometry args={[1.6, 0.46, 0.6]} />
      </mesh>
      <mesh material={MAT.dark} position={[0, 0.02, 0]}>
        <boxGeometry args={[1.56, 0.04, 0.56]} />
      </mesh>
      {/* glass box — raycast disabled so clicks reach the cards inside */}
      <mesh material={MAT.glass} position={[0, 0.75, 0]} raycast={noHit}>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
      </mesh>
      {/* glass shelf + felt riser for the back row */}
      <mesh material={MAT.glass} position={[0, 0.52, 0]} raycast={noHit}>
        <boxGeometry args={[1.55, 0.012, 0.55]} />
      </mesh>
      <mesh material={MAT.felt} position={[0, 0.575, -0.09]}>
        <boxGeometry args={[1.5, 0.11, 0.2]} />
      </mesh>
      {/* glass lid in an aluminium rim */}
      <mesh material={MAT.glass} position={[0, 1.005, 0]} raycast={noHit}>
        <boxGeometry args={[1.62, 0.012, 0.62]} />
      </mesh>
      {([0.31, -0.31] as const).map((z) => (
        <mesh key={`rim-z${z}`} material={MAT.alu} position={[0, 1.01, z]}>
          <boxGeometry args={[1.65, 0.02, 0.02]} />
        </mesh>
      ))}
      {([0.8125, -0.8125] as const).map((x) => (
        <mesh key={`rim-x${x}`} material={MAT.alu} position={[x, 1.01, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.645]} />
        </mesh>
      ))}
      {/* aluminium posts at the glass corners */}
      {([[-0.8, 0.3], [0.8, 0.3], [-0.8, -0.3], [0.8, -0.3]] as const).map(([x, z]) => (
        <mesh key={`${x}${z}`} material={MAT.alu} position={[x, 0.75, z]}>
          <boxGeometry args={[0.02, 0.5, 0.02]} />
        </mesh>
      ))}
      {lit && <pointLight position={[0, 0.95, 0]} intensity={LOOK.caseLight.intensity} distance={LOOK.caseLight.distance} color={LOOK.caseLight.color} />}
      {/* LED strips along the top front/back edges — the good stuff literally glows (emitters only, no light) */}
      {([0.27, -0.27] as const).map((z) => (
        <mesh key={`led${z}`} material={ledStripMat} position={[0, 0.985, z]} raycast={() => null}>
          <boxGeometry args={[1.5, 0.01, 0.015]} />
        </mesh>
      ))}
      {title && <mesh material={makeLabelMaterial(title, { bg: '#1c1d20', fg: '#f4f5f7', size: title.length > 14 ? 32 : 42 })} position={[0, 1.25, 0.1]}>
        <planeGeometry args={[0.9, 0.22]} />
      </mesh>}
      {children}
      {cards.map(({ card, slot }) => (
        <CardMesh key={card.id} card={card} slot={slot} />
      ))}
    </group>
  );
}
