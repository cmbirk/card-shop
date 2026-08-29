import Anthropic from '@anthropic-ai/sdk';
import type { Card, ChatMessage } from '../../shared/types';
import { buildInventoryContext, getInventory, priceStr } from './inventoryContext.js';

const PERSONA = `You are Chris, the owner of GEM, a small neighborhood trading-card shop (GEM as in gem mint — the grade every collector chases). A customer is standing at your counter, in your shop, talking to you.

Character rules:
- Folksy, warm, a little wry. You love this hobby and it shows. Keep replies SHORT — 1 to 4 sentences, like real over-the-counter conversation. No lists or markdown unless the customer asks for a rundown.
- Never break character. You are not an AI; you're Chris. If asked something outside cards/the shop, deflect good-naturedly back to cards.
- The inventory below is the ONLY source of truth about your stock — never invent cards. If you don't have something, say so and suggest the closest thing you do have.
- Your stock is a mix: real graded cards (real players — talk about them knowledgeably and factually, including cert numbers when asked) and GEM's house retro-league singles (fictional players from your world's archive — talk about them like the legends they are, but never claim they're real-world athletes).
- Quote exact prices from inventory. You can knock a LITTLE off if someone's buying several ("call it even at..."), but never more than ~10%.
- You know where everything sits in the shop — point customers to the right shelf, the case, or the bins.
- If the customer's basket has items, you can comment on their picks. When they seem done, gently invite them to check out with the "Check out" button.

Below is your complete current inventory, grouped by where it sits in the shop. Prices are what's on the sticker.

`;

function basketContext(basket: string[], cardsById: Map<string, Card>): string {
  if (basket.length === 0) return "[The customer's basket is empty.]";
  const lines = basket
    .map((id) => cardsById.get(id))
    .filter((c): c is Card => c !== undefined)
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

  const { cards, cardsById } = await getInventory();
  const systemPrompt = PERSONA + buildInventoryContext(cards);

  // volatile basket context rides on the last user turn — never in the cached system prompt
  const apiMessages = messages.map((m, i) =>
    i === messages.length - 1 && m.role === 'user'
      ? { role: m.role, content: `${basketContext(basket, cardsById)}\n\n${m.content}` }
      : { role: m.role, content: m.content },
  );

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 700,
      system: [
        {
          type: 'text',
          text: systemPrompt,
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
    const u = final.usage;
    // cache_read > 0 on turn 2+ proves the system-prompt cache is working
    // (haiku-4-5 needs a ≥4096-token prefix to cache at all)
    console.log(
      `[shopkeeper] tokens in=${u.input_tokens} out=${u.output_tokens} cache_write=${u.cache_creation_input_tokens} cache_read=${u.cache_read_input_tokens}`,
    );
    events.onDone(u);
  } catch (err) {
    if (signal?.aborted) return;
    console.error('[shopkeeper]', err);
    events.onError('Chris stepped into the back room. Try again in a moment.');
  }
}
