import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#060606] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-16 lg:ml-60 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-hide relative mt-[57px] pb-20 md:pb-0">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-transparent pointer-events-none" />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
