"use client";
import * as React from "react";
import { ArrowUp, Loader2, MessageSquare, PanelLeftClose, X, Check, AlertTriangle, Sparkles, Clock } from "lucide-react";
import { api, cn } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { MessageView, JobView } from "@/lib/editor/types";
import { toast } from "@/components/ui/toast";
import { PanelHeader, IconButton } from "../panel";
import { ChatMessage } from "./message";
import { PlanCard } from "../states/plan-card";
import type { Stage } from "../editor";
import { Kbd } from "@/components/ui/card";

const DEFAULT_SUGGESTIONS = ["Tighten the pacing", "Add a hook title", "Try a different caption style", "Make a 15 s cut"];

export function ChatPanel({ stage }: { stage: Stage }) {
  const set = useEditor((s) => s.set);
  return (
    <div className="flex h-full w-full flex-col">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" /> Editor
          </span>
        }
        right={
          <IconButton title="Collapse chat" onClick={() => set({ chatOpen: false })}>
            <PanelLeftClose className="h-3.5 w-3.5" />
          </IconButton>
        }
      />
      {stage === "editor" ? <Conversation /> : <StageFeed stage={stage} />}
    </div>
  );
}

function StageFeed({ stage }: { stage: Stage }) {
  const project = useEditor((s) => s.project);
  if (!project) return null;
  const jobs = [...project.jobs].reverse().slice(-12);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 flex items-start gap-2">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <Sparkles className="h-3 w-3 text-accent" />
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            {stage === "footage" && "Drop your footage and tell me what you want. I'll read every clip before I propose a plan."}
            {stage === "plan" && "Here is my plan. Edit any line or tell me what to change, then approve it and I'll build the first draft."}
            {stage === "building" && "Building the draft now. Once it's ready you can change anything by talking to me here or on the timeline."}
          </p>
        </div>
        {stage === "plan" && project.plan && <PlanCard plan={project.plan} compact />}
        {jobs.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
            {jobs.map((j) => (
              <JobLine key={j.id} job={j} assetName={project.assets.find((a) => a.id === j.assetId)?.name} />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted">Chat opens once your first draft is built.</div>
    </div>
  );
}

function JobLine({ job, assetName }: { job: JobView; assetName?: string }) {
  const icon =
    job.status === "DONE" ? <Check className="h-3 w-3 text-success" /> : job.status === "FAILED" ? <AlertTriangle className="h-3 w-3 text-danger" /> : job.status === "QUEUED" ? <Clock className="h-3 w-3 text-muted" /> : <Loader2 className="h-3 w-3 animate-spin text-accent" />;
  return (
    <li className="flex items-center gap-2 text-[11px] text-muted">
      {icon}
      <span className="capitalize">{job.type}</span>
      {assetName && <span className="truncate opacity-70">· {assetName}</span>}
      {job.message && job.status !== "DONE" && <span className="truncate">· {job.message}</span>}
      {job.status === "FAILED" && job.error && <span className="truncate text-danger">· {job.error}</span>}
    </li>
  );
}

function Conversation() {
  const projectId = useEditor((s) => s.projectId);
  const messages = useEditor((s) => s.messages);
  const setMessages = useEditor((s) => s.setMessages);
  const chatQueue = useEditor((s) => s.chatQueue);
  const enqueueChat = useEditor((s) => s.enqueueChat);
  const hasScript = useEditor((s) => !!s.script);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const hasPending = messages.some((m) => m.status === "pending");

  // auto-scroll on new content
  const lastKey = messages.length ? `${messages[messages.length - 1]!.id}:${messages[messages.length - 1]!.status}` : "";
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastKey, chatQueue.length]);

  const send = React.useCallback(
    async (text: string) => {
      setSending(true);
      try {
        const res = await api<{ userMessage: MessageView; assistantMessage: MessageView }>(`/api/projects/${projectId}/chat`, { method: "POST", json: { content: text } });
        const cur = useEditor.getState().messages;
        setMessages([...cur.filter((m) => m.id !== res.userMessage.id && m.id !== res.assistantMessage.id), res.userMessage, res.assistantMessage]);
      } catch (e) {
        toast.error("Couldn't send", e instanceof Error ? e.message : undefined);
      } finally {
        setSending(false);
      }
    },
    [projectId, setMessages],
  );

  // the queue: one instruction at a time, in order
  React.useEffect(() => {
    if (hasPending || sending || chatQueue.length === 0) return;
    const next = useEditor.getState().shiftChatQueue();
    if (next) void send(next);
  }, [hasPending, sending, chatQueue, send]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    enqueueChat(text);
    textareaRef.current?.focus();
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "ASSISTANT" && m.status === "done");
  const showDefaultChips = !hasPending && (!lastAssistant || !lastAssistant.data?.suggestions?.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <div className="px-3 py-2">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                <Sparkles className="h-3 w-3 text-accent" />
              </div>
              <p className="text-[13px] leading-relaxed text-muted">Your draft is ready. Tell me what to change: “make the intro faster”, “swap music to cinematic”, “add my name as a lower third”. Every reply is a checkpoint you can go back to.</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={m.id} message={m} isLast={m.id === lastAssistant?.id && i >= messages.length - 2} onSuggestion={(s) => enqueueChat(s)} />
        ))}
        {showDefaultChips && messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-1">
            {DEFAULT_SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => enqueueChat(s)} className="rounded-full border border-border bg-bg-2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-fg">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-1">
            {DEFAULT_SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => enqueueChat(s)} className="rounded-full border border-border bg-bg-2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-fg">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {chatQueue.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Queued · runs in order</div>
          {chatQueue.map((q, i) => (
            <div key={`${q}-${i}`} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-[11px]">
              <span className="font-mono text-[10px] text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{q}</span>
              <button type="button" onClick={() => useEditor.setState((s) => ({ chatQueue: s.chatQueue.filter((_, j) => j !== i) }))} className="text-muted hover:text-fg" aria-label="Remove from queue">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-border p-2">
        <div className={cn("flex items-end gap-1.5 rounded-xl border border-border bg-bg-2 p-1.5 pl-3 transition-colors focus-within:border-accent/50")}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            disabled={!hasScript}
            placeholder={hasPending ? "Type the next change; it will run after this one…" : "Ask for a change…"}
            className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed text-fg outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || !hasScript}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-black transition-opacity disabled:opacity-30"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-muted">
          <span>
            <Kbd>⌘</Kbd> <Kbd>↵</Kbd> send · <Kbd>⇧↵</Kbd> newline
          </span>
          {hasPending && <span className="inline-flex items-center gap-1 text-accent"><Loader2 className="h-3 w-3 animate-spin" /> editing</span>}
        </div>
      </div>
    </div>
  );
}
