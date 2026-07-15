import { getActiveVenueId } from "@/lib/venue";
import { getBookings } from "@/lib/queries";
import ReceivablesClient from "@/components/ReceivablesClient";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const bookings = await getBookings(venueId);
  return <ReceivablesClient bookings={bookings} />;
}
