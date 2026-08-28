import { useEffect, useRef, useState } from 'react';
import { useDialogueStore } from '../stores/dialogueStore';
import { useBasketStore } from '../stores/basketStore';
import { useUIStore } from '../stores/uiStore';

const CHIPS = ["What's the best thing in the shop?", 'Got any rookie cards?', 'What should I get for under $20?'];

export function ChatWindow() {
  const { messages, streamingText, isStreaming, isOpen } = useDialogueStore();
  const basketCount = useBasketStore((s) => s.items.length);
  const phase = useUIStore((s) => s.checkoutPhase);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingText]);

  if (!isOpen) return null;

  const submit = (text: string) => {
    setInput('');
    void useDialogueStore.getState().send(text);
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span>Mel — GEM</span>
        <button onClick={() => useDialogueStore.getState().close()} title="Close">✕</button>
      </div>
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {isStreaming && <div className="msg assistant">{streamingText || '…'}</div>}
      </div>
      {phase === 'atCounter' && basketCount > 0 && (
        <button className="btn checkout-cta" onClick={() => useUIStore.getState().setPhase('moodCheck')}>
          Check out ({basketCount} {basketCount === 1 ? 'card' : 'cards'})
        </button>
      )}
      <div className="chat-chips">
        {CHIPS.map((c) => (
          <button key={c} className="chip" disabled={isStreaming} onClick={() => submit(c)}>
            {c}
          </button>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Mel anything…"
          disabled={isStreaming}
        />
        <button className="btn" type="submit" disabled={isStreaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
