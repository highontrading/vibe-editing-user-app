"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-bg-2">
      {items.map((it, i) => (
        <div key={it.q}>
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
            <span className="text-sm font-medium">{it.q}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open === i && "rotate-180")} />
          </button>
          {open === i && <div className="fade-up px-5 pb-4 text-sm leading-relaxed text-muted">{it.a}</div>}
        </div>
      ))}
    </div>
  );
}
