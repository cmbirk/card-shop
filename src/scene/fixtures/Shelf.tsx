import type { Fixture } from '@shared/types';
import type { PlacedCard } from '../../systems/placement';
import { MAT, ledStripMat, makeLabelMaterial } from '../materials';
import { CardMesh } from '../cards/CardMesh';
import { roundedBox } from '../geo';
import { ProductRow } from './SealedProduct';

const ROW_Y = [0.5, 0.9, 1.3, 1.7]; // glass shelf heights — must match SHELF_ROW_Y in systems/placement.ts
const W = 2.0; // outer width
const D = 0.42; // outer depth
const BASE = 0.37; // top of the base plinth
const TOP = 1.95; // top of the glass body
const POST = 0.022; // brushed-aluminium corner posts
const noHit = () => null;

/**
 * Tall glass display cabinet against a wall: light-grey laminate base, back and header, slim aluminium
 * corner posts, glass shelves, glass sides and front, an LED strip under the header. Cards stand on
 * easels facing local +Z. All glass is raycast-transparent so clicks reach the cards inside.
 */
export function Shelf({ fixture, cards }: { fixture: Fixture; cards: PlacedCard[] }) {
  const glassH = TOP - BASE;
  const glassY = (TOP + BASE) / 2;
  return (
    <group>
      {/* base plinth + dark kick */}
      <mesh material={MAT.laminate} geometry={roundedBox(W, BASE - 0.04, D - 0.02, 0.012)} position={[0, BASE / 2 + 0.02, -0.01]} castShadow />
      <mesh material={MAT.dark} position={[0, 0.02, 0]}>
        <boxGeometry args={[W - 0.04, 0.04, D - 0.06]} />
      </mesh>
      {/* light-grey back panel — cards read cleanly against it (pure white blooms) */}
      <mesh material={MAT.laminate} position={[0, glassY, -D / 2 + 0.01]}>
        <boxGeometry args={[W - 0.02, glassH, 0.015]} />
      </mesh>
      {/* header */}
      <mesh material={MAT.laminate} geometry={roundedBox(W, 0.08, D - 0.02, 0.012)} position={[0, TOP + 0.04, -0.01]} castShadow />
      {/* aluminium corner posts */}
      {([
        [-W / 2 + POST / 2, D / 2 - POST / 2],
        [W / 2 - POST / 2, D / 2 - POST / 2],
        [-W / 2 + POST / 2, -D / 2 + POST / 2],
        [W / 2 - POST / 2, -D / 2 + POST / 2],
      ] as const).map(([x, z]) => (
        <mesh key={`${x},${z}`} material={MAT.alu} position={[x, glassY, z]}>
          <boxGeometry args={[POST, glassH, POST]} />
        </mesh>
      ))}
      {/* glass shelves */}
      {ROW_Y.map((y) => (
        <mesh key={y} material={MAT.glass} position={[0, y, 0]} raycast={noHit}>
          <boxGeometry args={[W - 2 * POST, 0.012, D - 0.06]} />
        </mesh>
      ))}
      {/* glass sides + front */}
      {[-W / 2 + 0.005, W / 2 - 0.005].map((x) => (
        <mesh key={x} material={MAT.glass} position={[x, glassY, 0]} raycast={noHit}>
          <boxGeometry args={[0.006, glassH, D - 0.04]} />
        </mesh>
      ))}
      <mesh material={MAT.glass} position={[0, glassY, D / 2 - 0.005]} raycast={noHit}>
        <boxGeometry args={[W - 2 * POST, glassH, 0.006]} />
      </mesh>
      {/* LED strip under the header — an emitter for bloom only (lighting comes from look.ts) */}
      <mesh material={ledStripMat} position={[0, TOP - 0.012, D / 2 - 0.05]} raycast={noHit}>
        <boxGeometry args={[W - 0.1, 0.01, 0.02]} />
      </mesh>
      {/* sign above the header */}
      <mesh material={makeLabelMaterial(fixture.label, { bg: '#1c1d20', fg: '#f4f5f7' })} position={[0, TOP + 0.21, 0.0]}>
        <planeGeometry args={[1.1, 0.24]} />
      </mesh>
      {cards.map(({ card, slot }) => (
        <CardMesh key={card.id} card={card} slot={slot} />
      ))}
      {/* sealed product fills rows the cards don't reach (cards fill top-down) */}
      {ROW_Y.filter((_, i) => i < ROW_Y.length - Math.ceil(cards.length / fixture.slots.cols)).map((y, i) => (
        <ProductRow
          key={y}
          sport={fixture.accepts.sport ?? 'baseball'}
          y={y + 0.006}
          seed={[...fixture.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) + i * 77}
        />
      ))}
    </group>
  );
}
