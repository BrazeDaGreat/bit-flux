import { LoadingScreen, Shimmer } from "@/components/Skeleton";

/** Two columns of short rows, same grid the finished screen uses. */
export default function Loading() {
  return (
    <LoadingScreen
      title="Tags & people"
      blurb="Two things the AI files by: what a thought is about, and who it involves."
      width="max-w-4xl"
    >
      <div className="mt-7 grid gap-x-10 gap-y-9 md:grid-cols-2">
        <Column label="tags" />
        <Column label="people" className="md:border-l md:border-line md:pl-10" />
      </div>
    </LoadingScreen>
  );
}

function Column({ label, className = "" }: { label: string; className?: string }) {
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="mb-3.5 flex items-baseline justify-between border-b border-line pb-1.5">
        <h2 className="font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint max-lg:text-[0.75rem]">
          {label}
        </h2>
      </div>
      <div className="flex flex-col gap-2.5" aria-hidden="true">
        {["w-[58%]", "w-[72%]", "w-[44%]", "w-[65%]", "w-[51%]"].map((width) => (
          <Shimmer key={width} className={`h-3 ${width}`} />
        ))}
      </div>
    </section>
  );
}
