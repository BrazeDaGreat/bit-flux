import { LoadingScreen, Shimmer, SkeletonRows } from "@/components/Skeleton";

/** The list, waiting: the search row and filter chips above it, then rows. */
export default function Loading() {
  return (
    <LoadingScreen title="Your thoughts">
      <div className="mt-5">
        <div className="flex items-center gap-2">
          <Shimmer className="h-9 flex-1 rounded-xl" />
          <Shimmer className="h-9 w-24 shrink-0 rounded-xl max-lg:hidden" />
        </div>
        <div className="mt-4">
          <SkeletonRows />
        </div>
      </div>
    </LoadingScreen>
  );
}
