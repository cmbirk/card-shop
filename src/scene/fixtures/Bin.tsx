import type { PlacedCard } from '../../systems/placement';
import { MAT, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';

/** Discount bin: open box on legs, cards riffled inside. */
export function Bin({ cards }: { cards: PlacedCard[] }) {
  const w = 0.7;
  const d = 0.5;
  const rim = 0.9;
  const boxH = 0.35;
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
      {/* price sign on the front */}
      <mesh material={makeLabelMaterial('Bargain Bin', { bg: '#a63d40', size: 58 })} position={[0, rim - boxH / 2, d / 2 + 0.012]}>
        <planeGeometry args={[0.5, 0.14]} />
      </mesh>
      {cards.map(({ card, slot }) => (
        <CardMesh key={card.id} card={card} slot={slot} />
      ))}
    </group>
  );
}
