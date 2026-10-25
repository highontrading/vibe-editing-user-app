import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="px-8 py-10 md:px-12">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-64" />
      <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
