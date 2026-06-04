"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Salad } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "هل هذي الوجبة مناسبة لطفلي اللي عنده حساسية مكسرات؟",
  "وش أبدّل فيه عشاء اليوم بشيء أصح؟",
  "وش الفطور الأنسب لهدفي؟",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "صار خطأ. حاولي مرة ثانية.");
        setMessages(next); // drop the empty assistant placeholder
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch {
      setError("صار خطأ في الاتصال. حاولي مرة ثانية.");
      setMessages(next);
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col container-app w-full max-w-2xl py-6 min-h-0">
      {/* Messages */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4">
        {empty ? (
          <div className="m-auto text-center max-w-md">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-brand-lavender/30 mb-4">
              <Salad className="size-7 text-brand-purple-900" aria-hidden="true" />
            </div>
            <h1 className="font-extrabold text-2xl text-brand-ink leading-tight">
              اسألي المستشارة
            </h1>
            <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
              اسأليني عن وجباتك أو خطة عائلتك — أجاوبكِ على أساس بياناتك المسجّلة.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-start min-h-11 rounded-2xl border border-brand-purple-900/15 bg-white px-4 py-3 text-brand-ink text-sm leading-relaxed hover:bg-brand-lavender/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "self-end bg-brand-purple-900 text-white"
                  : "self-start bg-white border border-brand-ink/5 text-brand-ink"
              }`}
            >
              {m.content ? (
                m.content
              ) : (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none text-brand-purple-900"
                  aria-label="جارٍ الكتابة"
                />
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p
          role="alert"
          className="text-brand-pink text-sm font-bold mb-2 text-center"
        >
          {error}
        </p>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 rounded-2xl border border-brand-ink/10 bg-white p-2 focus-within:ring-2 focus-within:ring-brand-purple-900"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="اكتبي سؤالك…"
          disabled={streaming}
          className="flex-1 min-h-11 resize-none bg-transparent px-2 py-2 text-brand-ink placeholder:text-brand-ink-muted/50 focus-visible:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="إرسال"
          className="inline-flex items-center justify-center size-11 flex-shrink-0 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          {streaming ? (
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Send className="size-5 -scale-x-100" aria-hidden="true" />
          )}
        </button>
      </form>
      <p className="mt-2 text-brand-ink-muted text-sm text-center leading-relaxed">
        إرشاد مساعِد فقط — راجعي طبيبك في الأمور الطبية.
      </p>
    </div>
  );
}
