import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "info" | "danger" | "success" }) {
  const colors = { accent: "bg-accent", info: "bg-accent-2", danger: "bg-danger", success: "bg-success" };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
