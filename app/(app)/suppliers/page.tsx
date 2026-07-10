import { getActiveVenueId } from "@/lib/venue";
import { getSuppliers, getPurchases } from "@/lib/queries";
import SuppliersClient from "@/components/SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const venueId = await getActiveVenueId();
  if (!venueId) return null;
  const [suppliers, purchases] = await Promise.all([
    getSuppliers(venueId),
    getPurchases(venueId),
  ]);
  return <SuppliersClient suppliers={suppliers} purchases={purchases} />;
}
