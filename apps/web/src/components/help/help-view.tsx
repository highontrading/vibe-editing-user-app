"use client";
import * as React from "react";
import { ArrowUp, ChevronDown, MessageCircle, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { api, cn } from "@/lib/utils";

type Faq = { id: string; question: string; answer: string; category: string };
type Msg = { role: "user" | "assistant"; text: string; related?: { id: string; question: string }[] };

const STARTERS = ["How do I upload footage?", "What is the plan?", "Can I undo an AI change?", "Why is there a watermark?", "How do captions work?"];

export function HelpView({ faq }: { faq: Faq[] }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("All");
  const [open, setOpen] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([{ role: "assistant", text: "Hi! Ask me anything about uploads, recipes, the plan, captions, exports or billing. I answer from the help topics; a human reads everything I can't answer." }]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const cats = ["All", ...Array.from(new Set(faq.map((f) => f.category)))];
  const filtered = faq.filter((f) => (cat === "All" || f.category === cat) && (!q || (f.question + " " + f.answer).toLowerCase().includes(q.toLowerCase())));
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{ answer: string; related: { id: string; question: string }[] }>("/api/help", { method: "POST", json: { message: t } });
      setMessages((m) => [...m, { role: "assistant", text: res.answer, related: res.related }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `Sorry, something went wrong${e instanceof Error ? `: ${e.message}` : ""}. Email support@vibe.video and we'll help.` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-8 py-10 md:px-12">
      <PageHeader eyebrow="Help" title="Need any help?" description="Search the help topics or ask the assistant. It can explain features and, soon, act on your behalf (“turn off emoji captions for me”)." />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help topics" className="h-10 pl-9" />
          </div>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {cats.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)} className="shrink-0">
                {c}
              </Chip>
            ))}
          </div>
          <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-bg-2">
            {filtered.length ? (
              filtered.map((f) => (
                <div key={f.id}>
                  <button onClick={() => setOpen(open === f.id ? null : f.id)} className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left">
                    <span className="text-sm font-medium">{f.question}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open === f.id && "rotate-180")} />
                  </button>
                  {open === f.id && <div className="fade-up px-5 pb-4 text-sm leading-relaxed text-muted">{f.answer}</div>}
                </div>
              ))
            ) : (
              <EmptyState title="No topics match" description="Try asking the assistant instead." compact className="border-0" />
            )}
          </div>
        </div>

        <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-bg-2">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="text-sm font-semibold">Help assistant</div>
          </div>
          <div ref={listRef} className="flex-1 space-y-3 overflow-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed", m.role === "user" ? "bg-fg text-bg" : "bg-bg-3 text-fg")}>
                  {m.text}
                  {m.related && m.related.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.related.map((r) => (
                        <button key={r.id} onClick={() => send(r.question)} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-fg">
                          {r.question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-bg-3 px-3.5 py-2 text-sm text-muted">Thinking…</div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-white/25 hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <MessageCircle className="h-4 w-4 text-muted" />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            <button type="submit" disabled={!input.trim() || busy} className={cn("flex h-8 w-8 items-center justify-center rounded-lg", input.trim() ? "bg-fg text-bg" : "bg-white/8 text-muted")} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
