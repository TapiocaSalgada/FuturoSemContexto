import AppLayout from "@/components/AppLayout";

export default function Loading() {
  return (
    <AppLayout>
      <div className="pb-24 animate-pulse">
        {/* Banner Skeleton */}
        <div className="w-full h-[56vh] lg:h-[66vh] bg-zinc-900 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-transparent to-transparent z-10" />
          <div className="absolute bottom-8 lg:bottom-14 left-8 lg:left-14 z-20 max-w-2xl space-y-4 w-full">
            <div className="w-32 h-6 bg-zinc-800 rounded-full" />
            <div className="w-3/4 h-12 lg:h-16 bg-zinc-800 rounded-lg" />
            <div className="w-full h-4 bg-zinc-800 rounded mt-4" />
            <div className="w-5/6 h-4 bg-zinc-800 rounded" />
            <div className="flex gap-3 mt-6">
              <div className="w-40 h-12 bg-zinc-800 rounded-full" />
              <div className="w-48 h-12 bg-zinc-800 rounded-full" />
            </div>
          </div>
        </div>

        <div className="px-6 lg:px-14 mt-8 space-y-12">
          {/* Row 1 Skeleton: Continue Watching (Wider Cards) */}
          <section>
            <div className="w-48 h-6 bg-zinc-800 rounded mb-5" />
            <div className="flex gap-4 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={`cw-${i}`} className="w-[170px] lg:w-[210px] shrink-0">
                  <div className="aspect-video bg-zinc-900 rounded-2xl" />
                  <div className="w-3/4 h-4 bg-zinc-800 rounded mt-3" />
                  <div className="w-1/2 h-3 bg-zinc-800 rounded mt-2" />
                </div>
              ))}
            </div>
          </section>

          {/* Row 2 Skeleton: Regular Cards */}
          <section>
            <div className="w-40 h-6 bg-zinc-800 rounded mb-5" />
            <div className="flex gap-4 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={`rg-${i}`} className="w-[130px] lg:w-[160px] shrink-0">
                  <div className="aspect-[2/3] bg-zinc-900 rounded-xl" />
                  <div className="w-full h-3 bg-zinc-800 rounded mt-3" />
                </div>
              ))}
            </div>
          </section>

          {/* Row 3 Skeleton: Regular Cards */}
          <section>
            <div className="w-52 h-6 bg-zinc-800 rounded mb-5" />
            <div className="flex gap-4 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={`rg2-${i}`} className="w-[130px] lg:w-[160px] shrink-0">
                  <div className="aspect-[2/3] bg-zinc-900 rounded-xl" />
                  <div className="w-full h-3 bg-zinc-800 rounded mt-3" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
