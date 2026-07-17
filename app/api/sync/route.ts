import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/db/schema";
import { syncBookingsFromSheet } from "@/lib/sheet-sync";
import { authToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Scheduled sync: run bookings sync for every venue that has a saved sheetId.
// Protected by a token (?token= or Authorization: Bearer). Point a Render Cron
// Job at this URL hourly.
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

  const rows = await db
    .select({ venueId: settings.venueId, value: settings.value })
    .from(settings)
    .where(eq(settings.key, "sheetId"));

  const results: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.value) continue;
    try {
      results[r.venueId] = await syncBookingsFromSheet(r.venueId, r.value);
    } catch (e) {
      results[r.venueId] = { ok: false, error: String(e) };
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), venues: results });
}
