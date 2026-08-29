import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { CARD_SIZE } from '@shared/data/shopLayout';
import { inventoryById } from '../../systems/inventory';
import { getCardHome } from '../../systems/cardRegistry';
import { HOLD_PILE_ID } from '../fixtures/HoldPile';
import { makeDetailMaterials, getDetailGeometries, isRefractor, type SweepUniforms } from './atlas';
import { Slab } from './Slab';
import { useInspectStore, type InspectMode } from '../../stores/inspectStore';
import { useBasketStore } from '../../stores/basketStore';
import { FEEL, easeOutBack, easeOutCubic, easeInOutQuad, easeInCubic } from '../../feel';
import { sfx } from '../../systems/sfx';

export function CardInHand() {
  const heldCardId = useInspectStore((s) => s.heldCardId);
  if (!heldCardId) return null;
  return <HeldCard key={heldCardId} cardId={heldCardId} />;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); // lying face-up on the counter

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
    sweepSide: 1, // which side of centre the light band was on last frame (for the shimmer trigger)
    shimmerAt: 0,
  });
  const refractor = isRefractor(card);

  // dev-only: scripted tilt for the verify loop (see scripts/verify.mjs `tilt`)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const a = anim.current;
    (window as unknown as { __tilt?: (yaw: number, pitch: number) => void }).__tilt = (yaw, pitch) => {
      a.targetYaw = yaw;
      a.targetPitch = pitch;
    };
    return () => {
      delete (window as unknown as { __tilt?: unknown }).__tilt;
    };
  }, []);

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

  useFrame((state, dtRaw) => {
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
        const prevYaw = a.yaw;
        const prevPitch = a.pitch;
        a.yaw = THREE.MathUtils.damp(a.yaw, a.targetYaw, FEEL.dragLambda, dt);
        a.pitch = THREE.MathUtils.damp(a.pitch, a.targetPitch, FEEL.dragLambda, dt);
        if (refractor) {
          // the light band is a fixed function of the pose, so it moves with the card like real light
          const sweep = 0.5 + 0.5 * Math.sin(a.yaw * FEEL.sheenSweepScale + a.pitch * 1.2);
          const u = (detail.front.userData.sweep as SweepUniforms | undefined);
          if (u) u.uSweep.value = sweep;
          const vel = dt > 0 ? (Math.abs(a.yaw - prevYaw) + Math.abs(a.pitch - prevPitch)) / dt : 0;
          const side = sweep >= 0.5 ? 1 : -1;
          if (side !== a.sweepSide && vel > FEEL.shimmerVelocity && state.clock.elapsedTime - a.shimmerAt > FEEL.shimmerCooldown) {
            sfx.shimmer();
            a.shimmerAt = state.clock.elapsedTime;
          }
          a.sweepSide = side;
        }
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
        // off to the counter: fly to the hold pile's next slot with a toss arc, fading out at the end
        a.t += dt / FEEL.toHoldDuration;
        const kt = Math.min(a.t, 1);
        const k = easeInCubic(kt);
        const pile = getCardHome(HOLD_PILE_ID);
        if (pile) {
          const n = useBasketStore.getState().items.length;
          _v.set(n * FEEL.holdFanSpread, 0.01, 0);
          pile.localToWorld(_v);
          pile.getWorldQuaternion(_q);
          _q.multiply(_qFlat);
        } else {
          _v.set(-0.55, 1.05, -3.08);
          _q.copy(_qFlat);
        }
        g.position.lerpVectors(a.startPos, _v, k);
        g.position.y += Math.sin(Math.PI * kt) * 0.5; // high toss across the shop
        g.quaternion.slerpQuaternions(a.startQuat, _q, k);
        g.scale.setScalar(THREE.MathUtils.lerp(a.startScale, 1, k));
        const fade = kt < 0.8 ? 1 : 1 - (kt - 0.8) / 0.2;
        detail.front.transparent = detail.back.transparent = fade < 1;
        detail.front.opacity = detail.back.opacity = fade;
        if (a.t >= 1) {
          useBasketStore.getState().add(cardId);
          sfx.hold();
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
      {card.grade && <Slab card={card} />}
    </group>
  );
}
