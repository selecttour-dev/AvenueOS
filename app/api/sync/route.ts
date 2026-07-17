import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, venues } from "@/db/schema";
import { syncBookingsFromSheet } from "@/lib/sheet-sync";
import { runReminders } from "@/lib/reminders";
import { todayISO } from "@/lib/format";
import { authToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Scheduled job: (1) sync bookings from each venue's Google Sheet, (2) send any
// due 2-day / 1-day event reminders. Protected by a token (?token= or Bearer).
// Point a Render Cron Job at this URL hourly.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token =
    url.searchParams.get("token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.SYNC_TOKEN || authToken();
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const allVenues = await db.select({ id: venues.id, name: venues.name }).from(venues);
  const sheetRows = await db
    .select({ venueId: settings.venueId, value: settings.value })
    .from(settings)
    .where(eq(settings.key, "sheetId"));
  const sheetByVenue = new Map(sheetRows.map((r) => [r.venueId, r.value]));

  const results: Record<string, unknown> = {};
  for (const v of allVenues) {
    const out: Record<string, unknown> = {};
    const sheetId = sheetByVenue.get(v.id);
    if (sheetId) {
      try {
        out.sync = await syncBookingsFromSheet(v.id, sheetId);
      } catch (e) {
        out.sync = { ok: false, error: String(e) };
      }
    }
    try {
      out.reminders = await runReminders(v.id, v.name, today);
    } catch (e) {
      out.reminders = { ok: false, error: String(e) };
    }
    results[v.id] = out;
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), venues: results });
}
