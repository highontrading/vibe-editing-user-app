import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-white/6", className)} {...props} />;
}

export function CardSkeleton({ aspect = "aspect-video", className }: { aspect?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className={cn("w-full rounded-xl", aspect)} />
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
