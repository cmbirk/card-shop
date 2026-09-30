import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { LOOK } from './scene/look';
import { Shop } from './scene/Shop';
import { StationController } from './scene/StationController';
import { WalkController } from './scene/WalkController';
import { Waypoints } from './scene/Waypoints';
import { Shopkeeper } from './scene/Shopkeeper';
import { Maya } from './scene/Maya';
import { Loki } from './scene/Loki';
import { CardInHand } from './scene/cards/CardInHand';
import { UIOverlay } from './ui/UIOverlay';
import { loadInventory } from './systems/inventory';
import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { resumeCheckout } from './systems/checkoutReturn';
import { handleArrival } from './systems/arrival';

export default function App() {
  const [ready, setReady] = useState(false);
  // quality tier: drops to 'low' once if the frame rate can't hold — never changes the light count
  const [lowQuality, setLowQuality] = useState(false);
  // arm the monitor only once loading has settled: shader compiles, GLB/HDR loads and the walk-in
  // dip the frame rate for a few seconds and would otherwise drop a capable machine to low for good
  const [perfArmed, setPerfArmed] = useState(false);
  useEffect(() => {
    useAuthStore.getState().init(); // restore persisted session, watch auth changes
    loadInventory().then(() => {
      setReady(true);
      void resumeCheckout(); // ?checkout=success|cancel after Stripe
      handleArrival(); // ?invited=1 / stale invite links
    });
  }, []);

  // the inline #boot screen in index.html covers everything until the scene is genuinely
  // ready: inventory loaded AND the asset loaders (GLBs, HDRI, textures) have gone quiet
  // select `active` only: the whole store changes on every loader progress tick, and a burst of
  // fast (CDN-cached) loads re-rendering App each tick trips React's nested-update limit (#185)
  const assetsLoading = useProgress((s) => s.active);
  useEffect(() => {
    if (!ready || assetsLoading) return;
    const boot = document.getElementById('boot');
    if (!boot) return;
    // two frames so the first real render is on screen beneath the fade
    let raf = 0;
    raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearInterval((window as unknown as { __bootQuip?: number }).__bootQuip);
        boot.classList.add('done');
        setTimeout(() => boot.remove(), 600);
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, [ready, assetsLoading]);
  useEffect(() => {
    if (!ready || assetsLoading || perfArmed) return;
    const t = setTimeout(() => setPerfArmed(true), LOOK.perfArmDelayMs);
    return () => clearTimeout(t);
  }, [ready, assetsLoading, perfArmed]);

  if (!ready) return null; // #boot is showing

  return (
    <ErrorBoundary>
      <Canvas
        shadows="percentage"
        dpr={lowQuality ? [1, 1.5] : [1, 2]}
        camera={{ fov: 55, near: 0.05, far: 50, position: [0, 1.6, 9.2] }}
        style={{ position: 'fixed', inset: 0 }}
        onCreated={(st) => {
          st.gl.toneMappingExposure = LOOK.exposure; // tone mapping itself runs in the composer (it forces the renderer's off)
          if (import.meta.env.DEV) (window as unknown as { __three?: unknown }).__three = st; // scene probe for verify.mjs `eval`
        }}
      >
        <color attach="background" args={[LOOK.sky.horizon]} />
        <fog attach="fog" args={[LOOK.fog.color, LOOK.fog.near, LOOK.fog.far]} />
        <Shop />
        <Shopkeeper />
        <Maya />
        <Loki />
        <CardInHand />
        <Waypoints />
        <StationController />
        <WalkController />
        <AdaptiveDpr pixelated />
        {perfArmed && <PerformanceMonitor onDecline={() => setLowQuality(true)} />}
        <EffectComposer multisampling={0}>
          <N8AO
            enabled={!lowQuality}
            halfRes
            quality="medium"
            aoRadius={LOOK.ao.radius}
            distanceFalloff={LOOK.ao.distanceFalloff}
            intensity={LOOK.ao.intensity}
          />
          <Bloom
            luminanceThreshold={LOOK.bloom.threshold}
            luminanceSmoothing={LOOK.bloom.smoothing}
            intensity={LOOK.bloom.intensity}
            mipmapBlur
          />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <Vignette eskil={false} offset={LOOK.vignette.offset} darkness={LOOK.vignette.darkness} />
          <Noise premultiply opacity={LOOK.grain} />
          <SMAA />
        </EffectComposer>
      </Canvas>
      <UIOverlay />
    </ErrorBoundary>
  );
}
