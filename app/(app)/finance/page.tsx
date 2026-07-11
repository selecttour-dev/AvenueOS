import { getActiveVenueId } from "@/lib/venue";
import { getFixedCosts, getOperationalExpenses } from "@/lib/queries";
import FinanceClient from "@/components/FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const [fixedCosts, operational] = await Promise.all([
    getFixedCosts(venueId),
    getOperationalExpenses(venueId),
  ]);
  return <FinanceClient fixedCosts={fixedCosts} operational={operational} />;
}
