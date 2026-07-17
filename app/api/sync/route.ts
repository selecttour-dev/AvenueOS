import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, venues } from "@/db/schema";
import { syncBookingsFromSheet } from "@/lib/sheet-sync";
import { getRecipients, runReminders, sendTelegram } from "@/lib/reminders";
import {
  buildDailyDigest,
  buildWeeklyReport,
  setSendMarker,
  shouldSendMarker,
  tbilisiNow,
} from "@/lib/digest";
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

    // Morning digest (daily) + owners' report (Mondays), 09:00+ Tbilisi time,
    // sent once per day via settings markers.
    try {
      const tb = tbilisiNow();
      if (tb.hour >= 9) {
        const [tokenRow] = await db
          .select({ value: settings.value })
          .from(settings)
          .where(eq(settings.key, "telegramBotToken"));
        const token = process.env.TELEGRAM_BOT_TOKEN || tokenRow?.value;
        const recipients = token ? await getRecipients(v.id) : [];
        if (token && recipients.length > 0) {
          if (await shouldSendMarker(v.id, "digestSentOn", tb.dateISO)) {
            const body = await buildDailyDigest(v.id, v.name, tb.dateISO);
            for (const r of recipients) await sendTelegram(token, r.chatId, body);
            await setSendMarker(v.id, "digestSentOn", tb.dateISO);
            out.digest = { sent: recipients.length };
          }
          if (tb.weekday === 1 && (await shouldSendMarker(v.id, "weeklySentOn", tb.dateISO))) {
            const body = await buildWeeklyReport(v.id, v.name, tb.dateISO);
            for (const r of recipients) await sendTelegram(token, r.chatId, body);
            await setSendMarker(v.id, "weeklySentOn", tb.dateISO);
            out.weekly = { sent: recipients.length };
          }
        }
      }
    } catch (e) {
      out.digest = { ok: false, error: String(e) };
    }

    results[v.id] = out;
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), venues: results });
}
