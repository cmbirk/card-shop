import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { CARD_SIZE, SLAB_SIZE } from '@shared/data/shopLayout';
import { inventoryById } from '../../systems/inventory';
import { getCardHome } from '../../systems/cardRegistry';
import { makeDetailMaterials, getDetailGeometries } from './atlas';
import { makeLabelMaterial } from '../materials';
import { useInspectStore, type InspectMode } from '../../stores/inspectStore';
import { useBasketStore } from '../../stores/basketStore';
import { FEEL, easeOutBack, easeOutCubic, easeInOutQuad, easeInCubic } from '../../feel';
import { sfx } from '../../systems/sfx';

const slabShellMaterial = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.15,
  roughness: 0.05,
});

export function CardInHand() {
  const heldCardId = useInspectStore((s) => s.heldCardId);
  if (!heldCardId) return null;
  return <HeldCard key={heldCardId} cardId={heldCardId} />;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function HeldCard({ cardId }: { cardId: string }) {
  const card = inventoryById.get(cardId)!;
  const group = useRef<THREE.Group>(null!);
  const { camera, gl } = useThree();

  const detail = useMemo(() => makeDetailMaterials(card), [card]);
  useEffect(() => () => detail.dispose(), [detail]);
  const geos = getDetailGeometries();

  // animation state, all refs — zero react state per frame
  const anim = useRef({
    prevMode: 'idle' as InspectMode,
    t: 0,
    startPos: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    startScale: 1,
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    dist: FEEL.inspectDistance as number,
    distCur: FEEL.inspectDistance as number,
    lastFlip: useInspectStore.getState().requestFlip,
    dragging: false,
  });

  // drag-to-rotate + wheel zoom on the canvas while inspecting
  useEffect(() => {
    const el = gl.domElement;
    const a = anim.current;
    const down = (e: PointerEvent) => {
      if (useInspectStore.getState().mode !== 'inspecting') return;
      a.dragging = true;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!a.dragging) return;
      a.targetYaw += e.movementX * 0.009;
      a.targetPitch = THREE.MathUtils.clamp(a.targetPitch - e.movementY * 0.007, -1.3, 1.3);
    };
    const up = () => {
      if (!a.dragging) return;
      a.dragging = false;
      // cards want to face you front or back — settle to the nearest face if close
      const nearest = Math.round(a.targetYaw / Math.PI) * Math.PI;
      if (Math.abs(a.targetYaw - nearest) < 0.61) {
        a.targetYaw = nearest;
        a.targetPitch *= 0.3;
      }
    };
    const wheel = (e: WheelEvent) => {
      if (useInspectStore.getState().mode !== 'inspecting') return;
      e.preventDefault();
      a.dist = THREE.MathUtils.clamp(
        a.dist + e.deltaY * 0.0005,
        FEEL.inspectMinDistance,
        FEEL.inspectMaxDistance,
      );
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  const handPose = (out: { pos: THREE.Vector3; quat: THREE.Quaternion }, extraZ = 0) => {
    const a = anim.current;
    _v.set(0.02, -0.03, -(a.distCur + extraZ)).applyQuaternion(camera.quaternion);
    out.pos.copy(camera.position).add(_v);
    _e.set(a.pitch, a.yaw, 0);
    _q.setFromEuler(_e);
    out.quat.copy(camera.quaternion).multiply(_q);
  };

  const pose = useMemo(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() }), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const st = useInspectStore.getState();
    const a = anim.current;
    const g = group.current;
    if (!g) return;

    // phase entry
    if (st.mode !== a.prevMode) {
      a.t = 0;
      if (st.mode === 'pickingUp') {
        const home = getCardHome(cardId);
        if (home) {
          home.getWorldPosition(a.startPos);
          home.getWorldQuaternion(a.startQuat);
          g.position.copy(a.startPos);
          g.quaternion.copy(a.startQuat);
        }
      } else {
        a.startPos.copy(g.position);
        a.startQuat.copy(g.quaternion);
        a.startScale = g.scale.x;
      }
      a.prevMode = st.mode;
    }

    // flip requests
    if (st.requestFlip !== a.lastFlip) {
      a.lastFlip = st.requestFlip;
      a.targetYaw += Math.PI;
      sfx.flip();
    }

    switch (st.mode) {
      case 'pickingUp': {
        a.t += dt / FEEL.pickupDuration;
        const k = Math.min(a.t, 1);
        a.distCur = a.dist;
        handPose(pose);
        const kp = easeOutBack(k);
        g.position.lerpVectors(a.startPos, pose.pos, kp);
        g.position.y += Math.sin(Math.PI * k) * FEEL.pickupArcHeight; // swoop, not beeline
        g.quaternion.slerpQuaternions(a.startQuat, pose.quat, easeOutCubic(k));
        const s = 1 + 0.12 * Math.sin(Math.PI * k);
        g.scale.setScalar(s);
        if (a.t >= 1) st.transitionDone();
        break;
      }
      case 'inspecting': {
        a.yaw = THREE.MathUtils.damp(a.yaw, a.targetYaw, FEEL.dragLambda, dt);
        a.pitch = THREE.MathUtils.damp(a.pitch, a.targetPitch, FEEL.dragLambda, dt);
        a.distCur = THREE.MathUtils.damp(a.distCur, a.dist, 8, dt);
        // pull back slightly mid-flip so the edge doesn't feel paper-thin
        const flipFrac = Math.abs(((a.yaw % (Math.PI * 2)) + Math.PI * 2) % Math.PI);
        const pullback = Math.sin(Math.min(flipFrac, Math.PI - flipFrac) * 2) * FEEL.flipPullback;
        handPose(pose, pullback);
        easing.damp3(g.position, pose.pos, 0.06, dt);
        g.quaternion.copy(pose.quat);
        easing.damp3(g.scale, [1, 1, 1], 0.1, dt);
        break;
      }
      case 'returning': {
        a.t += dt / FEEL.returnDuration;
        const k = easeInOutQuad(Math.min(a.t, 1));
        const home = getCardHome(cardId);
        if (home) {
          home.getWorldPosition(_v);
          home.getWorldQuaternion(_q);
          g.position.lerpVectors(a.startPos, _v, k);
          g.quaternion.slerpQuaternions(a.startQuat, _q, k);
        }
        g.scale.setScalar(THREE.MathUtils.lerp(a.startScale, 1, k));
        if (a.t >= 1) {
          sfx.putBack();
          st.transitionDone();
        }
        break;
      }
      case 'toBasket': {
        a.t += dt / FEEL.toBasketDuration;
        const k = easeInCubic(Math.min(a.t, 1));
        // basket anchor, camera-relative, recomputed every frame
        _v.set(FEEL.basketAnchor[0], FEEL.basketAnchor[1], FEEL.basketAnchor[2]).applyQuaternion(camera.quaternion);
        _v.add(camera.position);
        g.position.lerpVectors(a.startPos, _v, k);
        g.position.y += Math.sin(Math.PI * Math.min(a.t, 1)) * 0.08; // toss arc
        g.scale.setScalar(THREE.MathUtils.lerp(a.startScale, 0.4, k));
        if (a.t >= 1) {
          useBasketStore.getState().add(cardId);
          sfx.basket();
          st.transitionDone();
        }
        break;
      }
    }
  });

  return (
    <group ref={group}>
      <mesh
        geometry={geos.front}
        material={detail.front}
        position-z={CARD_SIZE.t / 2}
        onDoubleClick={(e) => {
          e.stopPropagation();
          useInspectStore.getState().flip();
        }}
      />
      <mesh geometry={geos.back} material={detail.back} position-z={-CARD_SIZE.t / 2} rotation-y={Math.PI} />
      {card.grade && (
        <mesh material={slabShellMaterial}>
          <boxGeometry args={[SLAB_SIZE.w, SLAB_SIZE.h, SLAB_SIZE.t]} />
        </mesh>
      )}
      {card.grade && card.images && (
        <mesh
          material={makeLabelMaterial(card.grade.label, { bg: '#f5f5f0', fg: '#1a1a1a', size: 54 })}
          position={[0, SLAB_SIZE.h / 2 - 0.011, SLAB_SIZE.t / 2 + 0.0015]}
        >
          <planeGeometry args={[SLAB_SIZE.w * 0.96, 0.019]} />
        </mesh>
      )}
    </group>
  );
}
