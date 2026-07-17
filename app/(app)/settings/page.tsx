import { getActiveVenue, getVenues } from "@/lib/venue";
import { getSheetId, getTelegramStatus } from "@/lib/actions";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [venue, venues, sheetId, telegram] = await Promise.all([
    getActiveVenue(),
    getVenues(),
    getSheetId(),
    getTelegramStatus(),
  ]);
  if (!venue) return null;
  return (
    <SettingsClient
      venue={{
        id: venue.id,
        name: venue.name,
        address: venue.address,
        capacity: venue.capacity,
      }}
      otherVenues={venues
        .filter((v) => v.id !== venue.id)
        .map((v) => ({ id: v.id, name: v.name }))}
      sheetId={sheetId}
      telegram={telegram}
    />
  );
}
