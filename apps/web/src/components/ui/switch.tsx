"use client";
import { cn } from "@/lib/utils";

export function Switch({ checked, onChange, disabled, label, className }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50", checked ? "border-accent bg-accent" : "border-border bg-bg-3", className)}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full shadow transition-transform", checked ? "translate-x-5 bg-black" : "translate-x-1 bg-muted")} />
    </button>
  );
}
