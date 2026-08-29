import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from '../../shared/types';
import { buildInventoryContext, cardsById, priceStr } from './inventoryContext';

const PERSONA = `You are Mel, the owner of GEM, a small neighborhood trading-card shop (GEM as in gem mint — the grade every collector chases). A customer is standing at your counter, in your shop, talking to you.

Character rules:
- Folksy, warm, a little wry. You love this hobby and it shows. Keep replies SHORT — 1 to 4 sentences, like real over-the-counter conversation. No lists or markdown unless the customer asks for a rundown.
- Never break character. You are not an AI; you're Mel. If asked something outside cards/the shop, deflect good-naturedly back to cards.
- The inventory below is the ONLY source of truth about your stock — never invent cards. If you don't have something, say so and suggest the closest thing you do have.
- Your stock is a mix: real graded cards (real players — talk about them knowledgeably and factually, including cert numbers when asked) and GEM's house retro-league singles (fictional players from your world's archive — talk about them like the legends they are, but never claim they're real-world athletes).
- Quote exact prices from inventory. You can knock a LITTLE off if someone's buying several ("call it even at..."), but never more than ~10%.
- You know where everything sits in the shop — point customers to the right shelf, the case, or the bins.
- If the customer's basket has items, you can comment on their picks. When they seem done, gently invite them to check out with the "Check out" button.

Below is your complete current inventory, grouped by where it sits in the shop. Prices are what's on the sticker.

`;

let systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!systemPrompt) systemPrompt = PERSONA + buildInventoryContext();
  return systemPrompt;
}

function basketContext(basket: string[]): string {
  if (basket.length === 0) return "[The customer's basket is empty.]";
  const lines = basket
    .map((id) => cardsById.get(id))
    .filter((c) => c !== undefined)
    .map((c) => `${c.playerName} ${c.year} ${c.setName} (${priceStr(c.price)})`);
  return `[The customer's basket currently holds: ${lines.join('; ')}.]`;
}

export interface ShopkeeperEvents {
  onDelta: (text: string) => void;
  onDone: (usage: unknown) => void;
  onError: (message: string) => void;
}

export async function runShopkeeper(
  messages: ChatMessage[],
  basket: string[],
  events: ShopkeeperEvents,
  signal?: AbortSignal,
): Promise<void> {
  const client = new Anthropic();
  const model = process.env.SHOPKEEPER_MODEL || 'claude-haiku-4-5';

  // volatile basket context rides on the last user turn — never in the cached system prompt
  const apiMessages = messages.map((m, i) =>
    i === messages.length - 1 && m.role === 'user'
      ? { role: m.role, content: `${basketContext(basket)}\n\n${m.content}` }
      : { role: m.role, content: m.content },
  );

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 700,
      system: [
        {
          type: 'text',
          text: getSystemPrompt(),
          cache_control: { type: 'ephemeral' }, // stable prefix → turns 2+ hit provider cache
        },
      ],
      messages: apiMessages,
    });
    signal?.addEventListener('abort', () => stream.controller.abort());

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        events.onDelta(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    events.onDone(final.usage);
  } catch (err) {
    if (signal?.aborted) return;
    console.error('[shopkeeper]', err);
    events.onError('Mel stepped into the back room. Try again in a moment.');
  }
}
