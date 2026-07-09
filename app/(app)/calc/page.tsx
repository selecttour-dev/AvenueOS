import { getActiveVenueId } from "@/lib/venue";
import { getMenuData } from "@/lib/queries";
import CalcClient from "@/components/CalcClient";

export const dynamic = "force-dynamic";

export default async function CalcPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const data = await getMenuData(venueId);
  return (
    <CalcClient
      ingredients={data.ingredients}
      categories={data.categories}
      dishes={data.dishes}
    />
  );
}
