import { getActiveVenueId } from "@/lib/venue";
import { getOverview } from "@/lib/queries";
import OverviewClient from "@/components/OverviewClient";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const data = await getOverview(venueId);
  return <OverviewClient data={data} />;
}
