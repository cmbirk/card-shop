import { MAT, makeLabelMaterial } from '../materials';

/** Checkout counter: 3.0 x 0.9 x 0.6, top at y=1.0, register + paper bag props. */
export function Counter() {
  return (
    <group>
      {/* body */}
      <mesh material={MAT.walnut} position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[3, 1, 0.6]} />
      </mesh>
      {/* top slab */}
      <mesh material={MAT.wornTop} position={[0, 1.02, 0]}>
        <boxGeometry args={[3.1, 0.04, 0.7]} />
      </mesh>
      {/* front panel trim + recessed panels */}
      <mesh material={MAT.green} position={[0, 0.5, 0.305]}>
        <boxGeometry args={[2.9, 0.85, 0.01]} />
      </mesh>
      {[-0.95, 0, 0.95].map((x) => (
        <mesh key={x} material={MAT.walnut} position={[x, 0.5, 0.312]}>
          <boxGeometry args={[0.72, 0.6, 0.012]} />
        </mesh>
      ))}
      {/* top edge trim */}
      <mesh material={MAT.walnut} position={[0, 1.0, 0.34]}>
        <boxGeometry args={[3.1, 0.05, 0.03]} />
      </mesh>
      {/* register */}
      <group position={[-1, 1.04, 0]}>
        <mesh material={MAT.dark} position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.35, 0.24, 0.3]} />
        </mesh>
        <mesh position={[0, 0.2, 0.14]} rotation-x={-0.35}>
          <planeGeometry args={[0.26, 0.12]} />
          <meshBasicMaterial color="#9fdca8" />
        </mesh>
      </group>
      {/* paper bag */}
      <mesh material={MAT.cardboard} position={[0.9, 1.16, 0]} castShadow>
        <boxGeometry args={[0.22, 0.28, 0.14]} />
      </mesh>
      {/* counter card stand — impulse buys */}
      <mesh material={MAT.cream} position={[0.35, 1.1, 0.1]} rotation-x={-0.3}>
        <boxGeometry args={[0.3, 0.12, 0.02]} />
      </mesh>
      <mesh material={makeLabelMaterial('GEM', { bg: '#2e5e4e', fg: '#ffd97a' })} position={[0, 0.55, 0.315]}>
        <planeGeometry args={[1.4, 0.35]} />
      </mesh>
    </group>
  );
}
