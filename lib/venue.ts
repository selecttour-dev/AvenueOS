import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { venues } from "@/db/schema";

export const VENUE_COOKIE = "venue";

export async function getVenues() {
  return db
    .select()
    .from(venues)
    .where(eq(venues.active, true))
    .orderBy(asc(venues.id));
}

/** Active venue id from cookie; null when not chosen / invalid. */
export async function getActiveVenueId(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(VENUE_COOKIE)?.value;
  const id = raw ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) return null;
  const [venue] = await db.select().from(venues).where(eq(venues.id, id));
  return venue && venue.active ? venue.id : null;
}

export async function getActiveVenue() {
  const id = await getActiveVenueId();
  if (id == null) return null;
  const [venue] = await db.select().from(venues).where(eq(venues.id, id));
  return venue ?? null;
}
