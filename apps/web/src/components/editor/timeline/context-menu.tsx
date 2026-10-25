"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Scissors, Trash2, Copy, VolumeX, Volume2, HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: string;
  separator?: boolean;
}

export const MenuIcons = { Scissors, Trash2, Copy, VolumeX, Volume2, HelpCircle, Info };

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x, y });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);
  React.useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className="fixed z-[90] min-w-[200px] rounded-lg border border-border bg-bg-2/95 p-1 shadow-2xl backdrop-blur" style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/8 disabled:pointer-events-none disabled:opacity-40",
              it.danger && "text-danger hover:bg-danger/10",
            )}
          >
            {it.icon && <it.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />}
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <kbd className="font-mono text-[10px] text-muted">{it.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
