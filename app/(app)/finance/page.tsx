import { getActiveVenueId } from "@/lib/venue";
import {
  getFixedCosts,
  getIncomeTaxPct,
  getOperationalExpenses,
  getPartnersData,
} from "@/lib/queries";
import FinanceClient from "@/components/FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const [fixedCosts, operational, incomeTaxPct, partnersData] =
    await Promise.all([
      getFixedCosts(venueId),
      getOperationalExpenses(venueId),
      getIncomeTaxPct(venueId),
      getPartnersData(venueId),
    ]);
  return (
    <FinanceClient
      fixedCosts={fixedCosts}
      operational={operational}
      incomeTaxPct={incomeTaxPct}
      partnersData={partnersData}
    />
  );
}
