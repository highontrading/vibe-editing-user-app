import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="px-8 py-10 md:px-12">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-9 w-64" />
      <div className="mt-14 grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
