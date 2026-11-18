import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { ChatMessage } from '../types';
import { Button, inputClassName, Surface } from './ui';

const SESSION_KEY = 'hfc_ai_session_id_v1';

function getOrCreateSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `chat-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return 'chat-default';
  }
}

export const AIAssistantDrawer: React.FC = () => {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [sessionId] = useState(getOrCreateSessionId);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/ai/history/${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  }, [open, sessionId]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  if (!settings.aiEnabled) return null;

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || busy) return;

    const optimisticUser: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');
    setErrorText('');
    setBusy(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Could not reach menu assistant.');
      }
      if (data?.reply) {
        setMessages((prev) => [...prev, data.reply as ChatMessage]);
      }
    } catch (err: unknown) {
      setErrorText(err instanceof Error ? err.message : 'Could not reach menu assistant.');
    } finally {
      setBusy(false);
    }
  };

  const quickPrompts = [
    'آج کی ڈیلی ڈیلز کیا ہیں؟',
    'Most spicy chicken items?',
    'اسٹور کے اوقات اور ڈیلیوری چارجز؟',
    'Family dinner for 4 people?',
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Home Food Corner Menu Assistant"
        className="fixed right-4 bottom-20 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-gold/40 bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-surface transition-[transform,background-color] duration-150 hover:bg-surface/90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-primary md:right-6 md:bottom-6"
      >
        <MessageCircle className="h-5 w-5 text-gold" />
        <span>Menu Help · مینو اسسٹنٹ</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/70 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hfc-assistant-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          <Surface className="flex h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl sm:h-[600px] sm:rounded-card">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
              <div>
                <h2 id="hfc-assistant-title" className="text-base font-semibold text-foreground">
                  Home Food Corner Assistant
                </h2>
                <p className="font-urdu text-xs text-muted">
                  مینو، آفرز، اوقات اور ڈیلیوری کے بارے میں پوچھیں
                </p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setErrorText('');
                      void fetch(`/api/ai/history/${encodeURIComponent(sessionId)}`, {
                        method: 'DELETE',
                      }).catch(() => {});
                    }}
                    aria-label="Clear chat history"
                    title="Clear chat"
                    className="rounded-control p-2 text-muted hover:text-spicy focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close assistant"
                  className="rounded-control p-2 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Ask in English or Urdu about live menu dishes, spice levels, current Karachi timings, loyalty points, or delivery policies.
                  </p>
                  <p className="font-urdu text-sm text-foreground">
                    السلام علیکم! آپ ہوم فوڈ کارنر کے مینو، قیمتوں یا آفرز کے متعلق اردو یا انگلش میں سوال کر سکتے ہیں۔
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {quickPrompts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendQuestion(q)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:border-gold focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/60 bg-background text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}

              {busy ? (
                <p className="text-xs text-muted animate-pulse">Checking live kitchen menu…</p>
              ) : null}

              {errorText ? (
                <p role="alert" className="text-xs font-medium text-spicy">
                  {errorText}
                </p>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuestion(input);
              }}
              className="flex items-center gap-2 border-t border-border/60 p-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about menu, deals, timings…"
                aria-label="Ask menu assistant"
                className={inputClassName}
              />
              <Button type="submit" tone="primary" disabled={busy || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Surface>
        </div>
      ) : null}
    </>
  );
};
