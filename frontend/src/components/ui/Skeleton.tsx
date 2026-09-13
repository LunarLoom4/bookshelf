/**
 * Skeleton — pulsing placeholder shapes for loading states.
 * Use instead of spinners to show content shape before data arrives.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton shaped like a BookCard */
export function BookCardSkeleton() {
  return (
    <div className="card flex flex-col overflow-hidden">
      {/* Cover placeholder — 3:4 aspect ratio */}
      <Skeleton className="w-full h-44 rounded-none flex-shrink-0" />
      {/* Meta */}
      <div className="p-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-full mt-1" />
        <Skeleton className="h-3 w-2/3" />
        <div className="mt-3 flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton shaped like the BookDetail header */
export function BookDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row gap-8 mb-10">
        {/* Cover */}
        <Skeleton className="flex-shrink-0 w-40 sm:w-48 aspect-[3/4] rounded-lg" />
        {/* Meta */}
        <div className="flex-1 flex flex-col gap-3 pt-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full mt-2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/4 mt-4" />
        </div>
      </div>
      {/* Editions section */}
      <Skeleton className="h-6 w-32 mb-4" />
      <Skeleton className="h-16 w-full rounded-lg mb-3" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}
