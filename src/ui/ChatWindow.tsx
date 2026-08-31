import { useEffect, useRef, useState } from 'react';
import { useDialogueStore } from '../stores/dialogueStore';
import { SHOP_NAME } from '@shared/launch';
import { useAuthStore } from '../stores/authStore';
import { ShowChrisCard } from './ShowChrisCard';
import { useBasketStore } from '../stores/basketStore';
import { useUIStore } from '../stores/uiStore';
import { useSpeechStore } from '../stores/speechStore';

const CHIPS = ["What's the best thing in the shop?", 'Got any rookie cards?', 'What should I get for under $20?'];

const CHIP_META = { chris: { letter: 'C', cls: 'chris', name: 'Chris' }, maya: { letter: 'M', cls: 'maya', name: 'Maya' } } as const;

export function ChatWindow() {
  const { messages, streamingText, isStreaming, isOpen } = useDialogueStore();
  const speech = useSpeechStore((s) => s.current);

  // feed Chris's dialogue into the pinned speech surface while the chat is closed
  const lastCount = useRef(0);
  useEffect(() => {
    const sp = useSpeechStore.getState();
    if (isOpen) {
      sp.dismiss(); // the expanded window shows everything itself
      lastCount.current = messages.length;
      return;
    }
    if (isStreaming) {
      sp.stream(streamingText || '…');
      return;
    }
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      sp.say('chris', last.content);
    } else if (useSpeechStore.getState().current?.streaming) {
      sp.dismiss(); // stream aborted with no final line
    }
  }, [isOpen, isStreaming, streamingText, messages]);
  const isSeller = useAuthStore((s) => s.isSeller);
  const chips = isSeller ? ['How does consigning work?', 'What are my cards doing?', ...CHIPS.slice(0, 1)] : CHIPS;
  const basketCount = useBasketStore((s) => s.items.length);
  const phase = useUIStore((s) => s.checkoutPhase);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingText]);

  if (!isOpen) {
    if (!speech) return null;
    const meta = CHIP_META[speech.speaker];
    return (
      <div
        className="speech-card"
        role="status"
        onClick={() => {
          if (speech.speaker === 'chris') useDialogueStore.getState().open(); // same surface, expanded
        }}
        title={speech.speaker === 'chris' ? 'Open the conversation' : undefined}
      >
        <div className="speech-card-head">
          <span className={`speaker-chip ${meta.cls}`}>{meta.letter}</span>
          <span className="speech-card-name">{meta.name}</span>
          <button
            className="speech-card-x"
            onClick={(e) => {
              e.stopPropagation();
              useSpeechStore.getState().dismiss();
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
        <div className="speech-card-text">{speech.text}</div>
      </div>
    );
  }

  const submit = (text: string) => {
    setInput('');
    void useDialogueStore.getState().send(text);
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span>
          <span className="speaker-chip chris">C</span> Chris — {SHOP_NAME}
        </span>
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
        <ShowChrisCard />
        {chips.map((c) => (
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
          placeholder="Ask Chris anything…"
          disabled={isStreaming}
        />
        <button className="btn" type="submit" disabled={isStreaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
