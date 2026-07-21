import { getActiveVenueId } from "@/lib/venue";
import {
  getRegisterDay,
  getMonthSummary,
  getIncomeTaxPct,
  getPartnersLite,
  getAdvances,
  getDebts,
} from "@/lib/queries";
import { todayISO } from "@/lib/format";
import RegisterClient from "@/components/RegisterClient";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;

  const { date } = await searchParams;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : todayISO();
  const [y, m] = iso.split("-").map(Number);

  const [day, month, incomeTaxPct, partners, advances, debtList] =
    await Promise.all([
      getRegisterDay(venueId, iso),
      getMonthSummary(venueId, y, m),
      getIncomeTaxPct(venueId),
      getPartnersLite(venueId),
      getAdvances(venueId),
      getDebts(venueId),
    ]);

  return (
    <RegisterClient
      day={day}
      month={month}
      monthLabel={{ year: y, month: m }}
      incomeTaxPct={incomeTaxPct}
      partners={partners}
      advances={advances}
      debtList={debtList}
    />
  );
}
