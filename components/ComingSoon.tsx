export default function ComingSoon({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
      <span className="font-data text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
        {phase}
      </span>
      <h1 className="mt-2 font-hand text-[1.7rem] leading-tight tracking-[-0.01em] text-ink">
        {title}
      </h1>
      <div className="mt-3 max-w-[46ch] text-[0.86rem] leading-relaxed text-ink-soft">
        {children}
      </div>
    </div>
  );
}
