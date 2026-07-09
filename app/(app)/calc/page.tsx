import { getActiveVenueId } from "@/lib/venue";
import { getInventoryItems, getMenuData } from "@/lib/queries";
import CalcClient from "@/components/CalcClient";

export const dynamic = "force-dynamic";

export default async function CalcPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const [data, inventory] = await Promise.all([
    getMenuData(venueId),
    getInventoryItems(venueId),
  ]);
  return (
    <CalcClient
      ingredients={data.ingredients}
      categories={data.categories}
      dishes={data.dishes}
      inventoryItems={inventory}
    />
  );
}
