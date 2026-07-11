import { getActiveVenueId } from "@/lib/venue";
import {
  getInventoryItems,
  getMenuData,
  getPackages,
  getTargetFoodCostPct,
} from "@/lib/queries";
import CalcClient from "@/components/CalcClient";

export const dynamic = "force-dynamic";

export default async function CalcPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const [data, inventory, packages, targetPct] = await Promise.all([
    getMenuData(venueId),
    getInventoryItems(venueId),
    getPackages(venueId),
    getTargetFoodCostPct(venueId),
  ]);
  return (
    <CalcClient
      ingredients={data.ingredients}
      categories={data.categories}
      dishes={data.dishes}
      inventoryItems={inventory}
      packages={packages}
      targetPct={targetPct}
    />
  );
}
