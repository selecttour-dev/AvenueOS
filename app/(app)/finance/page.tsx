import { getActiveVenueId } from "@/lib/venue";
import { getFixedCosts } from "@/lib/queries";
import FinanceClient from "@/components/FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const fixedCosts = await getFixedCosts(venueId);
  return <FinanceClient fixedCosts={fixedCosts} />;
}
