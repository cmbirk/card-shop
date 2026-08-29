import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Shop } from './scene/Shop';
import { StationController } from './scene/StationController';
import { Waypoints } from './scene/Waypoints';
import { Shopkeeper } from './scene/Shopkeeper';
import { Maya } from './scene/Maya';
import { Basket3D } from './scene/Basket';
import { CardInHand } from './scene/cards/CardInHand';
import { UIOverlay } from './ui/UIOverlay';
import { loadInventory } from './systems/inventory';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    useAuthStore.getState().init(); // restore persisted session, watch auth changes
    loadInventory().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#1a120b',
          color: '#ffd97a',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, letterSpacing: 4 }}>GEM</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>opening up the shop…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 55, near: 0.05, far: 50, position: [0, 1.6, 9.2] }}
        style={{ position: 'fixed', inset: 0 }}
      >
        <color attach="background" args={['#241a10']} />
        <fog attach="fog" args={['#241a10', 10, 24]} />
        <Shop />
        <Shopkeeper />
        <Maya />
        <CardInHand />
        <Basket3D />
        <Waypoints />
        <StationController />
        <AdaptiveDpr pixelated />
        <EffectComposer>
          <Bloom luminanceThreshold={0.95} intensity={0.35} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
      </Canvas>
      <UIOverlay />
    </>
  );
}
