import type { PlacedCard } from '../../systems/placement';
import { MAT, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';

/** Glass display case for the good stuff: wood base, glass top box, interior warm light. */
export function DisplayCase({ cards }: { cards: PlacedCard[] }) {
  return (
    <group>
      {/* cabinet base */}
      <mesh material={MAT.walnut} position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
      </mesh>
      {/* glass box */}
      <mesh material={MAT.glass} position={[0, 0.75, 0]}>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
      </mesh>
      {/* glass shelf + velvet riser for the back row */}
      <mesh material={MAT.glass} position={[0, 0.52, 0]}>
        <boxGeometry args={[1.55, 0.012, 0.55]} />
      </mesh>
      <mesh position={[0, 0.575, -0.09]}>
        <boxGeometry args={[1.5, 0.11, 0.2]} />
        <meshStandardMaterial color="#5e1f24" roughness={1} />
      </mesh>
      {/* wood cap */}
      <mesh material={MAT.wornTop} position={[0, 1.01, 0]}>
        <boxGeometry args={[1.64, 0.03, 0.64]} />
      </mesh>
      {/* interior glow — the good stuff literally glows */}
      <pointLight position={[0, 0.95, 0]} intensity={2} distance={1.6} color="#ffd9a0" />
      <mesh material={makeLabelMaterial('The Good Stuff', { bg: '#3b2a1a', fg: '#ffd97a', size: 42 })} position={[0, 1.25, 0.1]}>
        <planeGeometry args={[0.9, 0.22]} />
      </mesh>
      {cards.map(({ card, slot }) => (
        <CardMesh key={card.id} card={card} slot={slot} />
      ))}
    </group>
  );
}
