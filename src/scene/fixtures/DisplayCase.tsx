import type { PlacedCard } from '../../systems/placement';
import { MAT, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';

/** Glass display case for the good stuff: wood base, glass top box, interior warm light. `glassTop` swaps the wood cap for a glass lid in a metal rim. */
export function DisplayCase({
  cards,
  title = 'The Good Stuff',
  glow = '#ffd9a0',
  glassTop = false,
}: {
  cards: PlacedCard[];
  title?: string;
  glow?: string;
  glassTop?: boolean;
}) {
  return (
    <group>
      {/* cabinet base */}
      <mesh material={MAT.walnut} position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
      </mesh>
      {/* glass box — raycast disabled so clicks reach the cards inside */}
      <mesh material={MAT.glass} position={[0, 0.75, 0]} raycast={() => null}>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
      </mesh>
      {/* glass shelf + velvet riser for the back row */}
      <mesh material={MAT.glass} position={[0, 0.52, 0]} raycast={() => null}>
        <boxGeometry args={[1.55, 0.012, 0.55]} />
      </mesh>
      <mesh position={[0, 0.575, -0.09]}>
        <boxGeometry args={[1.5, 0.11, 0.2]} />
        <meshStandardMaterial color="#5e1f24" roughness={1} />
      </mesh>
      {/* lid: a wood cap, or a glass pane held by a dark metal rim */}
      {glassTop ? (
        <>
          <mesh material={MAT.glass} position={[0, 1.005, 0]} raycast={() => null}>
            <boxGeometry args={[1.62, 0.012, 0.62]} />
          </mesh>
          {([0.31, -0.31] as const).map((z) => (
            <mesh key={`rim-z${z}`} material={MAT.dark} position={[0, 1.01, z]}>
              <boxGeometry args={[1.65, 0.025, 0.025]} />
            </mesh>
          ))}
          {([0.8125, -0.8125] as const).map((x) => (
            <mesh key={`rim-x${x}`} material={MAT.dark} position={[x, 1.01, 0]}>
              <boxGeometry args={[0.025, 0.025, 0.645]} />
            </mesh>
          ))}
        </>
      ) : (
        <mesh material={MAT.wornTop} position={[0, 1.01, 0]}>
          <boxGeometry args={[1.64, 0.03, 0.64]} />
        </mesh>
      )}
      {/* dark metal frame along the glass edges */}
      {([[-0.8, 0.3], [0.8, 0.3], [-0.8, -0.3], [0.8, -0.3]] as const).map(([x, z]) => (
        <mesh key={`${x}${z}`} material={MAT.dark} position={[x, 0.75, z]}>
          <boxGeometry args={[0.025, 0.52, 0.025]} />
        </mesh>
      ))}
      {/* interior glow — the good stuff literally glows */}
      <pointLight position={[0, 0.95, 0]} intensity={2} distance={1.6} color={glow} />
      <mesh material={makeLabelMaterial(title, { bg: '#3b2a1a', fg: '#ffd97a', size: title.length > 14 ? 32 : 42 })} position={[0, 1.25, 0.1]}>
        <planeGeometry args={[0.9, 0.22]} />
      </mesh>
      {cards.map(({ card, slot }) => (
        <CardMesh key={card.id} card={card} slot={slot} />
      ))}
    </group>
  );
}
