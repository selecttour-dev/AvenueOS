import { getActiveVenueId } from "@/lib/venue";
import {
  getRegisterDay,
  getMonthSummary,
  getIncomeTaxPct,
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

  const [day, month, incomeTaxPct] = await Promise.all([
    getRegisterDay(venueId, iso),
    getMonthSummary(venueId, y, m),
    getIncomeTaxPct(venueId),
  ]);

  return (
    <RegisterClient
      day={day}
      month={month}
      monthLabel={{ year: y, month: m }}
      incomeTaxPct={incomeTaxPct}
    />
  );
}
