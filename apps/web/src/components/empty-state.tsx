import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className, compact }: { icon?: React.ComponentType<{ className?: string }>; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center", compact ? "px-6 py-10" : "px-6 py-20", className)}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-muted">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="font-display text-2xl">{title}</div>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
    </div>
  );
}
