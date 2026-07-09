import { getVenues } from "@/lib/venue";
import VenuePicker from "@/components/VenuePicker";

export const dynamic = "force-dynamic";

export default async function SelectPage() {
  const venues = await getVenues();
  return <VenuePicker venues={venues.map((v) => ({ id: v.id, name: v.name, capacity: v.capacity }))} />;
}
