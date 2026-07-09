import { notFound } from "next/navigation";
import { getActiveVenueId } from "@/lib/venue";
import { getBookingDetail } from "@/lib/queries";
import BookingDetailClient from "@/components/BookingDetailClient";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) notFound();

  const booking = await getBookingDetail(venueId, bookingId);
  if (!booking) notFound();

  return <BookingDetailClient booking={booking} />;
}
