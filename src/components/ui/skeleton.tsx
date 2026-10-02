import { CoastHeader } from "./coast-header";
import { cn } from "./cn";

/**
 * A placeholder while something loads, sized to what will replace it.
 * Hidden from screen readers — the region around it says it is loading.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" data-skeleton="" className={cn("h-16 animate-pulse rounded-row bg-line", className)} />
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div data-skeleton="" className="grid gap-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} />
      ))}
    </div>
  );
}

/**
 * A screen on its way (plan §32.1: the land draws first, content skeletons
 * sized to it): its land with the title's place on it, then its rows on the
 * ground. It says so to a screen reader once.
 */
export function ScreenSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} data-screen-skeleton="">
      <CoastHeader>
        <div aria-hidden="true" className="grid gap-2 pb-4">
          <div className="h-8 w-48 animate-pulse rounded-full bg-land-ink/10" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded-full bg-land-ink/10" />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <SkeletonRows rows={4} />
      </div>
    </div>
  );
}
