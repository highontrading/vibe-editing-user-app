"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Align = "left" | "right";

const MenuCtx = React.createContext<{ close: () => void } | null>(null);

/** Small headless dropdown menu. Use `trigger` for the button and `MenuItem`s as children. */
export function Menu({ trigger, children, align = "right", className }: { trigger: React.ReactNode; children: React.ReactNode; align?: Align; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </div>
      {open && (
        <MenuCtx.Provider value={{ close: () => setOpen(false) }}>
          <div role="menu" className={cn("absolute z-40 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-border bg-bg-2 p-1 shadow-2xl", align === "right" ? "right-0" : "left-0")} onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        </MenuCtx.Provider>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, danger, className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ComponentType<{ className?: string }>; danger?: boolean }) {
  const ctx = React.useContext(MenuCtx);
  return (
    <button
      role="menuitem"
      className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-white/8", danger ? "text-danger" : "text-fg", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
        ctx?.close();
      }}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
      <span className="flex-1">{children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
