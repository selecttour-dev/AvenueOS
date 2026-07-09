import { getActiveVenueId } from "@/lib/venue";
import { getInventoryItems, getMenuData } from "@/lib/queries";
import InventoryClient from "@/components/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const [items, menu] = await Promise.all([
    getInventoryItems(venueId),
    getMenuData(venueId),
  ]);
  return <InventoryClient items={items} dishes={menu.dishes} />;
}
