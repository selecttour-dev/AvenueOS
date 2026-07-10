import { notFound } from "next/navigation";
import { getActiveVenueId } from "@/lib/venue";
import {
  getBookingDetail,
  getInventoryItems,
  getMenuData,
  getPackages,
} from "@/lib/queries";
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

  const [booking, packages, menu, inventory] = await Promise.all([
    getBookingDetail(venueId, bookingId),
    getPackages(venueId),
    getMenuData(venueId),
    getInventoryItems(venueId),
  ]);
  if (!booking) notFound();

  return (
    <BookingDetailClient
      booking={booking}
      packages={packages}
      dishes={menu.dishes}
      ingredients={menu.ingredients}
      inventoryItems={inventory}
    />
  );
}
