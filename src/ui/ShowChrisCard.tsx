import { useRef, useState } from 'react';
import { useDialogueStore } from '../stores/dialogueStore';
import { useAuthStore } from '../stores/authStore';
import { prepareScan } from '../admin/imagePrep';
import { checkPhoto, type GateResult } from '../systems/photoGates';
import type { Identified } from '../../api/identify';
import { sfx } from '../systems/sfx';

// "Show Chris a card": photograph your own card, Ximilar identifies it, Chris appraises it.
// Cheap local gates run before a credit is spent; every failure mode is Chris squinting at
// the card, never an error dialog. After 3 misses he gracefully punts.

const GATE_LINES: Record<Exclude<GateResult, 'ok'>, string> = {
  too_small: "That photo's a postage stamp — send me a bigger one.",
  too_dark: 'Bring it under the light for me? Can barely see the thing.',
  too_bright: "Whoa, that's all glare — angle it away from the lamp a touch.",
  blurry: "Hold her steady a sec — my squint's not cutting it.",
};
const OUTCOME_LINES: Record<string, string> = {
  not_a_card: "I'm seeing more table than card, friend. Get the whole card in the frame.",
  unclear: "Can't quite make it out — fill the frame with the card and try me again.",
  too_far: "Closer, closer… I don't bite.",
  unidentified: "Hm — it's a card alright, but I can't place it from this shot. Straight on, good light, one more try?",
};

export function ShowChrisCard() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const misses = useRef(0);
  const signedIn = useAuthStore((s) => !!s.session);
  const isStreaming = useDialogueStore((s) => s.isStreaming);
  if (!signedIn) return null;

  const handle = async (file: File | undefined) => {
    if (!file || busy) return;
    const dlg = useDialogueStore.getState();
    setBusy(true);
    try {
      const prepared = await prepareScan(file);
      const gate = await checkPhoto(prepared.file);
      if (gate !== 'ok') {
        sfx.tick();
        dlg.say(GATE_LINES[gate]);
        misses.current++;
        return;
      }
      dlg.say('Lemme grab my loupe…');
      const b64 = btoa(String.fromCharCode(...new Uint8Array(await prepared.file.arrayBuffer())));
      const token = useAuthStore.getState().session?.access_token;
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image: b64 }),
      });
      const body = (await res.json()) as { result?: Identified; error?: string };
      if (!res.ok || !body.result) {
        dlg.say(body.error ?? "The loupe's fogged up — give me a minute and try again.");
        return;
      }
      const r = body.result;
      if (r.outcome === 'match' || r.outcome === 'ambiguous') {
        misses.current = 0;
        const priceBit = r.price ? ` Recent sales (${r.price.kind}): median $${(r.price.median).toFixed(2)}, ${r.price.volume} sales.` : '';
        const summary =
          r.outcome === 'match'
            ? `${r.card!.fullName}${r.card!.team ? `, ${r.card!.team}` : ''} (confident match).${priceBit}`
            : `probably ${r.card!.fullName}, but it could be: ${(r.alternatives ?? []).join(' | ') || 'a close variant'} (uncertain — ask the customer which looks right).`;
        await dlg.send("What can you tell me about this card of mine?", { identified: summary.slice(0, 480) });
      } else {
        misses.current++;
        if (misses.current >= 3) {
          dlg.say("Tell you what — bring it by in person sometime and I'll give it a proper look. Photos only get us so far.");
          misses.current = 0;
        } else {
          dlg.say(OUTCOME_LINES[r.outcome] ?? OUTCOME_LINES.unidentified);
        }
      }
    } catch (e) {
      dlg.say(`Huh — ${(e as Error).message}. Try another shot?`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <button className="chip show-chris" disabled={busy || isStreaming} onClick={() => input.current?.click()} title="Photograph a card you own and Chris will take a look">
        {busy ? 'Chris is squinting…' : '📷 Show Chris a card'}
      </button>
      <input ref={input} type="file" accept="image/*,.heic,.heif" capture="environment" hidden onChange={(e) => void handle(e.target.files?.[0])} />
    </>
  );
}
