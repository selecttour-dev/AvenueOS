import { getActiveVenueId } from "@/lib/venue";
import { getForecastData } from "@/lib/queries";
import ForecastClient from "@/components/ForecastClient";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const data = await getForecastData(venueId);
  return <ForecastClient data={data} />;
}
