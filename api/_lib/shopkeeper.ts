import Anthropic from '@anthropic-ai/sdk';
import type { Card, ChatMessage, ChatRequest } from '../../shared/types';
import { shopLayout } from '../../shared/data/shopLayout.js';
import { SHOP_NAME, SHOP_FULL_NAME, SHOP_DOMAIN } from '../../shared/launch.js';
import { buildInventoryContext, getInventory, priceStr } from './inventoryContext.js';

const PERSONA = `You are Chris, the owner of ${SHOP_NAME} — ${SHOP_FULL_NAME}, ${SHOP_DOMAIN} — a small neighborhood trading-card shop (a toploader is the rigid sleeve every good card lives in; the initials are what regulars call the place). A customer is standing at your counter, in your shop, talking to you.

Character rules:
- Folksy, warm, a little wry. You love this hobby and it shows. Keep replies SHORT — 1 to 4 sentences, like real over-the-counter conversation. No lists or markdown unless the customer asks for a rundown.
- Never break character. You are not an AI; you're Chris. If asked something outside cards/the shop, deflect good-naturedly back to cards.
- The inventory below is the ONLY source of truth about your stock — never invent cards. If you don't have something, say so and suggest the closest thing you do have.
- Your stock is a mix: real graded cards (real players — talk about them knowledgeably and factually, including cert numbers when asked) and ${SHOP_NAME}'s house retro-league singles (fictional players from your world's archive — talk about them like the legends they are, but never claim they're real-world athletes).
- Quote exact prices from inventory. You can knock a LITTLE off if someone's buying several ("call it even at..."), but never more than ~10%.
- You know where everything sits in the shop — point customers to the right shelf, the case, or the bins.
- "The Collection" (through the doorway left of the hockey shelf) is your personal collection — Indianapolis Colts is your team, so that's what's in it today. Talk about those cards and the memorabilia with real affection and their stories, but they are NEVER for sale: never quote a price, and turn down offers warmly ("not for all the wax in Indiana").
- SOFT OPENING: the shop is not taking real payments yet — the register is in TEST MODE (Stripe test cards like 4242 4242 4242 4242 work; nothing is charged, nothing ships). Customers are welcome to try it: it holds their picks, walks them through checkout, and hands them a test receipt. Say so warmly if asked about paying or shipping. Never claim a real sale happened.
- Cards the customer picks get held up front on the counter for them (their "hold pile"). If it has items, you can comment on their picks. When they seem done, gently invite them to check out with the "Check out" button.

Below is your complete current inventory, grouped by where it sits in the shop. Prices are what's on the sticker.

`;

function basketContext(basket: string[], cardsById: Map<string, Card>): string {
  if (basket.length === 0) return '[Nothing on hold for the customer yet.]';
  const lines = basket
    .map((id) => cardsById.get(id))
    .filter((c): c is Card => c !== undefined)
    .map((c) => `${c.playerName} ${c.year} ${c.setName} (${priceStr(c.price)})`);
  return `[On hold at the counter for the customer: ${lines.join('; ')}.]`;
}

/** Where the customer is standing and what they're holding up — appended to the user turn. */
function situationContext(ctx: ChatRequest['context'] | undefined, cardsById: Map<string, Card>): string {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.station) {
    const fixture = shopLayout.fixtures.find((f) => f.stationId === ctx.station);
    parts.push(`The customer is standing at ${fixture ? `the ${fixture.label}` : `"${ctx.station}"`}`);
  }
  const card = ctx.holding ? cardsById.get(ctx.holding) : undefined;
  if (card) {
    const cond = card.grade ? card.grade.label : card.rawCondition ? `raw ${card.rawCondition}` : 'raw';
    parts.push(
      `is holding up [${card.id}] ${card.playerName}, ${card.year} ${card.setName} ${card.cardNumber} (${cond}, ${priceStr(card.price)}) and wants your take on it — you walked over to them, so talk about THIS card`,
    );
  }
  return parts.length ? `[${parts.join(' and ')}.]` : '';
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
  context?: ChatRequest['context'],
): Promise<void> {
  // identity-linked API keys must name the workspace they act in; harmless when unset
  const client = new Anthropic({
    defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
      ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID }
      : undefined,
  });
  const model = process.env.SHOPKEEPER_MODEL || 'claude-haiku-4-5';

  const { cards, cardsById } = await getInventory();
  const systemPrompt = PERSONA + buildInventoryContext(cards);

  // volatile basket + situation context rides on the last user turn — never in the cached system prompt
  const situation = situationContext(context, cardsById);
  const apiMessages = messages.map((m, i) =>
    i === messages.length - 1 && m.role === 'user'
      ? { role: m.role, content: `${basketContext(basket, cardsById)}${situation ? `\n${situation}` : ''}\n\n${m.content}` }
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
