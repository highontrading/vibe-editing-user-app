"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Collapsible panel with a fixed size: the content keeps its width/height while the box animates so nothing reflows. */
export function Panel({ open, axis, size, className, children }: { open: boolean; axis: "x" | "y"; size: number; className?: string; children: React.ReactNode }) {
  const style = axis === "x" ? { width: open ? size : 0 } : { height: open ? size : 0 };
  return (
    <motion.div
      initial={false}
      animate={style}
      transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.8 }}
      className={cn("relative shrink-0 overflow-hidden bg-bg", open ? className : "border-transparent", axis === "x" ? "h-full" : "w-full")}
      aria-hidden={!open}
    >
      <div className={cn("absolute inset-0", axis === "x" ? "h-full" : "w-full")} style={axis === "x" ? { width: size } : { height: size }}>
        {children}
      </div>
    </motion.div>
  );
}

export function PanelHeader({ title, right, className }: { title: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-10 shrink-0 items-center justify-between border-b border-border px-3", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</div>
      <div className="flex items-center gap-1">{right}</div>
    </div>
  );
}

export function IconButton({ className, active, title, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/8 hover:text-fg disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint, className }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-[11px] font-medium text-muted">
        <span>{label}</span>
        {hint && <span className="font-mono text-[10px] text-muted/80">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function Slider({ value, min, max, step = 1, onChange, onCommit, className }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onCommit?: (v: number) => void; className?: string }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      className={cn("vibe-range w-full", className)}
    />
  );
}

export function Section({ title, children, right, className }: { title: React.ReactNode; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 border-b border-border px-3 py-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({ value, options, onChange, size = "sm" }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; size?: "sm" | "xs" }) {
  return (
    <div className="inline-flex w-full rounded-md border border-border bg-bg-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-[5px] font-medium transition-colors",
            size === "xs" ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-[11px]",
            value === o.value ? "bg-white/12 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
