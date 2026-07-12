import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getActiveVenueId, getVenues } from "@/lib/venue";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [venues, activeVenueId] = await Promise.all([
    getVenues(),
    getActiveVenueId(),
  ]);
  if (!activeVenueId) redirect("/select");

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        activeVenueId={activeVenueId}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
