import WhatsNew from "@/components/WhatsNew";

export default function Preview() {
  return (
    <div className="flex h-dvh w-full items-start justify-center bg-surface-2 p-6">
      <div className="w-full max-w-5xl rounded-2xl border border-line bg-surface p-5">
        <WhatsNew />
      </div>
    </div>
  );
}
