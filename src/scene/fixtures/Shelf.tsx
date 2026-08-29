import type { Fixture } from '@shared/types';
import type { PlacedCard } from '../../systems/placement';
import { MAT, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';
import { ProductRow } from './SealedProduct';

const ROW_Y = [0.5, 0.9, 1.3, 1.7];

/** Wooden shelf unit: 2.0 wide x 0.4 deep x 1.9 tall, cards on easels facing local +Z. */
export function Shelf({ fixture, cards }: { fixture: Fixture; cards: PlacedCard[] }) {
  return (
    <group>
      {/* side panels */}
      <mesh material={MAT.walnut} position={[-1, 0.95, 0]} castShadow>
        <boxGeometry args={[0.04, 1.9, 0.4]} />
      </mesh>
      <mesh material={MAT.walnut} position={[1, 0.95, 0]} castShadow>
        <boxGeometry args={[0.04, 1.9, 0.4]} />
      </mesh>
      {/* back panel */}
      <mesh material={MAT.walnut} position={[0, 0.95, -0.18]}>
        <boxGeometry args={[2, 1.9, 0.03]} />
      </mesh>
      {/* boards with a front lip */}
      {ROW_Y.map((y) => (
        <group key={y}>
          <mesh material={MAT.wornTop} position={[0, y, 0]} castShadow>
            <boxGeometry args={[2, 0.03, 0.38]} />
          </mesh>
          <mesh material={MAT.walnut} position={[0, y - 0.008, 0.19]}>
            <boxGeometry args={[2, 0.045, 0.012]} />
          </mesh>
        </group>
      ))}
      {/* crown + kick base */}
      <mesh material={MAT.walnut} position={[0, 1.93, 0.02]} castShadow>
        <boxGeometry args={[2.12, 0.07, 0.46]} />
      </mesh>
      <mesh material={MAT.walnut} position={[0, 0.08, 0.01]}>
        <boxGeometry args={[2.08, 0.16, 0.44]} />
      </mesh>
      {/* sign */}
      <mesh material={makeLabelMaterial(fixture.label, { bg: '#2e5e4e' })} position={[0, 2.05, 0.05]}>
        <planeGeometry args={[1.2, 0.3]} />
      </mesh>
      {/* warm aisle light so card faces read — the key light can't reach them */}
      <pointLight position={[0, 2.3, 1.1]} intensity={1.6} distance={3.8} color="#fff0d8" />
      {cards.map(({ card, slot }) => (
        <CardMesh key={card.id} card={card} slot={slot} />
      ))}
      {/* sealed product fills rows the cards don't reach (cards fill top-down) */}
      {ROW_Y.filter((_, i) => i < ROW_Y.length - Math.ceil(cards.length / fixture.slots.cols)).map((y, i) => (
        <ProductRow
          key={y}
          sport={fixture.accepts.sport ?? 'baseball'}
          y={y + 0.015}
          seed={[...fixture.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) + i * 77}
        />
      ))}
    </group>
  );
}
