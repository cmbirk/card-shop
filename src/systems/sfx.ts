// Tiny synthesized sound effects — no audio assets needed.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

export const sfx = {
  tick: () => tone(2200, 0.03, 'sine', 0.03),
  shimmer: () => {
    tone(3200, 0.06, 'sine', 0.025, 4800);
    setTimeout(() => tone(4200, 0.05, 'sine', 0.018, 5600), 40);
  },
  pickup: () => tone(500, 0.12, 'triangle', 0.06, 900),
  flip: () => tone(300, 0.08, 'triangle', 0.05, 600),
  putBack: () => tone(700, 0.08, 'sine', 0.05, 400),
  basket: () => {
    tone(220, 0.12, 'triangle', 0.08, 160);
    setTimeout(() => tone(1320, 0.18, 'sine', 0.05, 1760), 70);
  },
  glide: () => tone(180, 0.35, 'sine', 0.025, 90),
  tantrum: () => {
    tone(160, 0.25, 'square', 0.06, 60);
    setTimeout(() => tone(120, 0.2, 'triangle', 0.08, 50), 180);
    setTimeout(() => tone(90, 0.3, 'square', 0.05, 40), 340);
  },
  checkout: () => {
    tone(880, 0.1, 'sine', 0.06);
    setTimeout(() => tone(1108, 0.1, 'sine', 0.06), 110);
    setTimeout(() => tone(1318, 0.22, 'sine', 0.06), 220);
  },
};
