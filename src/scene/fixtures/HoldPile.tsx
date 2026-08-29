import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import { CARD_SIZE } from '@shared/data/shopLayout';
import { useBasketStore, formatCents } from '../../stores/basketStore';
import { useUIStore } from '../../stores/uiStore';
import { useNavStore } from '../../stores/navStore';
import { inventoryById } from '../../systems/inventory';
import { registerCard, unregisterCard } from '../../systems/cardRegistry';
import { getCardVisual } from '../cards/atlas';
import { mulberry32, spread } from '../../systems/rng';
import { FEEL } from '../../feel';
import { sfx } from '../../systems/sfx';

export const HOLD_PILE_ID = 'hold-pile';

/**
 * "I'll hold these up front for you." The cards a customer has picked, fanned face-up on the
 * counter beside the register. Cards fly here from the shelves (CardInHand `toBasket`);
 * at the counter you can hover for the price and click one to put it back.
 */
export function HoldPile() {
  const items = useBasketStore((s) => s.items);
  const tantrumCount = useUIStore((s) => s.tantrumCount);
  const group = useRef<THREE.Group>(null!);
  const cardRefs = useRef<(THREE.Group | null)[]>([]);
  const scatter = useRef({ seen: 0, t: 0 });
  const drift = useRef<number[]>([]); // per-card sideways drift for the sweep, precomputed

  useEffect(() => {
    registerCard(HOLD_PILE_ID, group.current);
    return () => unregisterCard(HOLD_PILE_ID);
  }, []);

  // tantrum: the pile gets swept off the counter (uiStore clears it a beat later)
  useFrame((_, dt) => {
    const s = scatter.current;
    if (tantrumCount !== s.seen) {
      s.seen = tantrumCount;
      s.t = 0.0001;
      const rand = mulberry32(tantrumCount + 3);
      drift.current = cardRefs.current.map(() => spread(rand));
    }
    if (s.t > 0) {
      s.t = Math.min(s.t + dt / 2.6, 1); // keeps falling until uiStore clears the pile
      cardRefs.current.forEach((g, i) => {
        if (!g) return;
        const d = drift.current[i] ?? 0;
        g.position.x += (0.6 + d * 0.4) * dt;
        g.position.y -= 1.4 * Math.min(s.t * 4, 1) * dt;
        g.rotation.z += (1 + d) * dt * 3;
      });
      if (s.t >= 1) s.t = 0;
    }
  });

  return (
    <group ref={group} position={[-0.55, 1.045, 0.12]}>
      {items.map((id, i) => (
        <HeldCard key={id} id={id} index={i} setRef={(el) => (cardRefs.current[i] = el)} />
      ))}
    </group>
  );
}

function HeldCard({ id, index, setRef }: { id: string; index: number; setRef: (el: THREE.Group | null) => void }) {
  const card = inventoryById.get(id);
  const inner = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const rand = mulberry32((card?.seed ?? index) + 11);
  const x = index * FEEL.holdFanSpread + spread(rand) * 0.004;
  const y = index * 0.0025;
  const rz = spread(rand) * 0.12 - index * 0.04;
  const visual = card ? getCardVisual(id) : null;

  useFrame((_, dt) => {
    if (!inner.current) return;
    const lift = hovered ? 0.02 : 0;
    easing.damp(inner.current.position, 'y', lift, 1 / FEEL.hoverLambda, dt);
  });

  if (!card || !visual) return null;
  const atCounter = () => useNavStore.getState().currentStation === 'counter' && useNavStore.getState().mode === 'station';

  return (
    <group ref={setRef} position={[x, y, 0]} rotation={[-Math.PI / 2, 0, rz]}>
      <group ref={inner} rotation-z={card.landscape ? Math.PI / 2 : 0}>
        <mesh
          geometry={visual.frontGeometry}
          material={visual.frontMaterial}
          position-z={CARD_SIZE.t / 2}
          castShadow
          onPointerOver={(e) => {
            if (!atCounter()) return;
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            if (!atCounter()) return;
            e.stopPropagation();
            setHovered(false);
            sfx.putBack();
            useBasketStore.getState().remove(id);
          }}
        />
        <mesh geometry={visual.backGeometry} material={visual.backMaterial} position-z={-CARD_SIZE.t / 2} rotation-y={Math.PI} />
        {hovered && (
          <Html position={[0, 0, 0.06]} center distanceFactor={0.9} style={{ pointerEvents: 'none' }}>
            <div className="price-chip">
              <span className="price-chip-name">{card.playerName}</span>
              <span className="price-chip-price">{formatCents(card.price)}</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
