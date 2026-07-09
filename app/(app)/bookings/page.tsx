import { getActiveVenueId } from "@/lib/venue";
import { getBookings } from "@/lib/queries";
import BookingsClient from "@/components/BookingsClient";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const rows = await getBookings(venueId);
  return <BookingsClient bookings={rows} />;
}
