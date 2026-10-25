"use client";
import * as React from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Toast = { id: number; title: string; description?: string; tone?: "success" | "error" | "info" };
const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; remove: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "success" }),
  error: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "error" }),
  info: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "info" }),
};

export function Toaster() {
  const { toasts, remove } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-bg-2 p-3 shadow-xl")}>
          {t.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : t.tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 text-danger" /> : <Info className="mt-0.5 h-4 w-4 text-accent-2" />}
          <div className="flex-1">
            <div className="text-sm font-medium">{t.title}</div>
            {t.description && <div className="text-xs text-muted">{t.description}</div>}
          </div>
          <button onClick={() => remove(t.id)} className="text-muted hover:text-fg">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
