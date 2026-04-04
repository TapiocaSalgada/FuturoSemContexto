import AppLayout from "@/components/AppLayout";

export default function Loading() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-6xl mx-auto space-y-6 animate-fadeIn">
        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
          <div className="h-full w-1/2 animate-pulse" style={{ backgroundColor: "var(--accent)" }} />
        </div>

        <div className="h-44 sm:h-56 lg:h-72 rounded-3xl bg-zinc-900 animate-pulse" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={`anime-loading-${idx}`} className="space-y-2">
              <div className="aspect-[3/4] rounded-2xl bg-zinc-900 animate-pulse" />
              <div className="h-3 rounded bg-zinc-900/80 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
