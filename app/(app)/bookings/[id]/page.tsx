import { notFound } from "next/navigation";
import { getActiveVenue } from "@/lib/venue";
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
  const venue = await getActiveVenue();
  if (!venue) return null;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) notFound();

  const [booking, packages, menu, inventory] = await Promise.all([
    getBookingDetail(venue.id, bookingId),
    getPackages(venue.id),
    getMenuData(venue.id),
    getInventoryItems(venue.id),
  ]);
  if (!booking) notFound();

  return (
    <BookingDetailClient
      booking={booking}
      venueName={venue.name}
      packages={packages}
      dishes={menu.dishes}
      categories={menu.categories}
      ingredients={menu.ingredients}
      inventoryItems={inventory}
    />
  );
}
