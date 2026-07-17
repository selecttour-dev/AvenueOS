import { getActiveVenueId } from "@/lib/venue";
import { getAnalytics } from "@/lib/queries";
import AnalyticsClient from "@/components/AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const data = await getAnalytics(venueId, 12);
  return <AnalyticsClient data={data} />;
}
