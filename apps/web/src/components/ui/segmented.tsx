"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact inline select that looks like a pill ("Auto ⌄"). */
export function PillSelect<T extends string | number>({ value, onChange, options, icon: Icon, className, title }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; icon?: React.ComponentType<{ className?: string }>; className?: string; title?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" title={title} onClick={() => setOpen((o) => !o)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-white/6 hover:text-fg">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{current?.label ?? String(value)}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 min-w-[140px] rounded-xl border border-border bg-bg-2 p-1 shadow-2xl">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn("flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-white/8", o.value === value ? "text-accent" : "text-fg")}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
