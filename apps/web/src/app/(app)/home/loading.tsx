import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-full">
      <section className="flex min-h-[62vh] items-center justify-center px-8">
        <div className="flex w-full max-w-2xl flex-col items-center gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-36 w-full rounded-2xl" />
        </div>
      </section>
    </div>
  );
}
