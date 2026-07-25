import { getActiveVenue } from "@/lib/venue";
import { getSetupBudget } from "@/lib/queries";
import SetupClient from "@/components/SetupClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const venue = await getActiveVenue();
  if (!venue) return null;
  const budget = await getSetupBudget(venue.id);
  return <SetupClient venueName={venue.name} budget={budget} />;
}
