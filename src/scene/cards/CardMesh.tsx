import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import type * as THREE from 'three';
import { easing } from 'maath';
import type { Card } from '@shared/types';
import { CARD_SIZE } from '@shared/data/shopLayout';
import type { SlotTransform } from '../../systems/placement';
import { getCardVisual } from './atlas';
import { Slab } from './Slab';
import { registerCard, unregisterCard } from '../../systems/cardRegistry';
import { useInspectStore } from '../../stores/inspectStore';
import { useBasketStore } from '../../stores/basketStore';
import { useUIStore } from '../../stores/uiStore';
import { useNavStore } from '../../stores/navStore';
import { useDialogueStore } from '../../stores/dialogueStore';
import { formatCents } from '../../stores/basketStore';
import { FEEL } from '../../feel';
import { sfx } from '../../systems/sfx';

/** A card in its home slot (shelf / bin / case). Hover lifts it; click picks it up. */
export function CardMesh({ card, slot }: { card: Card; slot: SlotTransform }) {
  const group = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const held = useInspectStore((s) => s.heldCardId === card.id);
  const inBasket = useBasketStore((s) => s.items.includes(card.id));
  const sold = useUIStore((s) => s.soldIds.includes(card.id));
  const hidden = held || inBasket || sold;

  const visual = getCardVisual(card.id);

  useEffect(() => {
    registerCard(card.id, group.current);
    return () => unregisterCard(card.id);
  }, [card.id]);

  useFrame((_, dt) => {
    if (!inner.current) return;
    const target = hovered && !hidden ? FEEL.hoverScale : 1;
    const lift = hovered && !hidden ? FEEL.hoverLift : 0;
    easing.damp3(inner.current.scale, [target, target, target], 1 / FEEL.hoverLambda, dt);
    easing.damp(inner.current.position, 'z', lift, 1 / FEEL.hoverLambda, dt);
  });

  const canInteract = () => {
    const nav = useNavStore.getState();
    return nav.mode === 'station' && !useDialogueStore.getState().isOpen;
  };

  return (
    <group ref={group} position={slot.position} rotation={slot.rotation} visible={!hidden}>
      <group ref={inner}>
        <mesh
          geometry={visual.frontGeometry}
          material={visual.frontMaterial}
          position-z={CARD_SIZE.t / 2}
          castShadow
          onPointerOver={(e) => {
            if (hidden || !canInteract()) return;
            e.stopPropagation();
            setHovered(true);
            sfx.tick();
          }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            if (hidden || !canInteract()) return;
            e.stopPropagation();
            setHovered(false);
            sfx.pickup();
            useInspectStore.getState().pickUp(card.id);
          }}
        />
        <mesh
          geometry={visual.backGeometry}
          material={visual.backMaterial}
          position-z={-CARD_SIZE.t / 2}
          rotation-y={Math.PI}
        />
        {card.grade && <Slab card={card} />}
        {hovered && !hidden && (
          <Html position={[0, CARD_SIZE.h * 0.72, 0]} center distanceFactor={0.9} style={{ pointerEvents: 'none' }}>
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
