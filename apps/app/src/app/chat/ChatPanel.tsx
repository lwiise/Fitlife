"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Salad } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "هل وجبة اليوم مناسبة لطفلي المصاب بحساسية المكسرات؟",
  "بماذا أستبدل عشاء اليوم ليكون أصح؟",
  "ما الفطور الأنسب لهدفي؟",
];

export function ChatPanel({ ownerSex }: { ownerSex?: string | null }) {
  const g = genderPick(ownerSex);
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
        setError(body.error ?? g("حدث خطأ. حاولي مرة أخرى.", "حدث خطأ. حاول مرة أخرى."));
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
      setError(g("تعذّر الاتصال. حاولي مرة أخرى.", "تعذّر الاتصال. حاول مرة أخرى."));
      setMessages(next);
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col container-app w-full max-w-2xl py-6 min-h-0">
      {/* Messages */}
      <div className="flex-1 flex flex-col gap-3 pb-4">
        {empty ? (
          <div className="m-auto text-center max-w-md">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-brand-lavender/30 mb-4">
              <Salad className="size-7 text-brand-purple-900" aria-hidden="true" />
            </div>
            <h1 className="font-extrabold text-2xl text-brand-ink leading-tight">
              {g("اسألي المستشارة", "اسأل المستشارة")}
            </h1>
            <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
              {g(
                "اسأليني عن وجباتك أو خطة عائلتك — أجاوبكِ على أساس بياناتك المسجّلة.",
                "اسألني عن وجباتك أو خطة عائلتك — أجاوبك على أساس بياناتك المسجّلة.",
              )}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-start min-h-11 rounded-2xl border border-brand-purple-900/15 bg-brand-card px-4 py-3 text-brand-ink text-sm leading-relaxed hover:bg-brand-lavender/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
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
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "self-end bg-brand-purple-900 text-white"
                  : "self-start bg-brand-card border border-brand-line text-brand-ink"
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
        <div ref={bottomRef} className="scroll-mb-44" />
      </div>

      {/* Composer — pinned to the bottom of the viewport (above the tab bar
          on phones) so a long conversation never scrolls it away. */}
      <div className="sticky bottom-[var(--app-tabbar-h)] z-10 -mx-4 bg-brand-surface/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-brand-surface/85 sm:mx-0 sm:px-0">
      {error && (
        <p
          role="alert"
          className="mb-2 text-center text-sm font-bold text-critical"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 rounded-2xl border border-brand-ink/10 bg-brand-card p-2 focus-within:ring-2 focus-within:ring-brand-purple-900"
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
          placeholder={g("اكتبي سؤالك…", "اكتب سؤالك…")}
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
      <p className="mt-2 text-meta text-brand-ink-muted text-center">
        {g("إرشاد مساعِد فقط — راجعي طبيبكِ في الأمور الطبية.", "إرشاد مساعِد فقط — راجع طبيبك في الأمور الطبية.")}
      </p>
      </div>
    </div>
  );
}
