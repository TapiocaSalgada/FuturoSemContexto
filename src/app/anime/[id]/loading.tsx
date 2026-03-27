import AppLayout from "@/components/AppLayout";

export default function Loading() {
  return (
    <AppLayout>
      <div className="pb-24 animate-pulse">
        {/* Banner Skeleton */}
        <div className="w-full h-[40vh] bg-zinc-900 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent z-10" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-10 -mt-20 relative z-20">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Skeleton */}
            <div className="w-48 lg:w-56 aspect-[2/3] bg-zinc-800 rounded-2xl shadow-2xl shrink-0" />
            
            <div className="flex-1 space-y-4 pt-10 md:pt-20">
              <div className="w-3/4 h-10 bg-zinc-800 rounded-lg" />
              <div className="flex gap-2">
                <div className="w-20 h-6 bg-zinc-800 rounded-full" />
                <div className="w-20 h-6 bg-zinc-800 rounded-full" />
              </div>
              <div className="space-y-2 pt-4">
                <div className="w-full h-4 bg-zinc-800 rounded" />
                <div className="w-full h-4 bg-zinc-800 rounded" />
                <div className="w-2/3 h-4 bg-zinc-800 rounded" />
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-10">
            <div className="space-y-6">
              <div className="w-48 h-8 bg-zinc-800 rounded-lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-2xl" />
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="w-40 h-8 bg-zinc-800 rounded-lg" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-4 bg-zinc-800 rounded" />
                    <div className="w-full h-12 bg-zinc-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
