"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onClose, title, children, className, width = "max-w-lg" }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; className?: string; width?: string }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full rounded-2xl border border-border bg-bg-2 shadow-2xl", width, className)}>
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">{title}</div>
            <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-white/10 hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
