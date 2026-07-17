// Google Sheets → app sync for bookings.
// Reads a PUBLIC (link-shared) Google Sheet's monthly tabs via the gviz CSV
// endpoint — no API key / service account needed. One-way, non-destructive:
// updates matched bookings, inserts new ones, never deletes, never overwrites
// an app-set price.

import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { bookings, clients } from "@/db/schema";

const MONTHS_KA = [
  "იანვარი", // იანვარი
  "თებერვალი", // თებერვალი
  "მარტი", // მარტი
  "აპრილი", // აპრილი
  "მაისი", // მაისი
  "ივნისი", // ივნისი
  "ივლისი", // ივლისი
  "აგვისტო", // აგვისტო
  "სექტემბერი", // სექტემბერი
  "ოქტომბერი", // ოქტომბერი
  "ნოემბერი", // ნოემბერი
  "დეკემბერი", // დეკემბერი
];

export type SyncResult = {
  ok: boolean;
  error?: string;
  added: number;
  updated: number;
  skipped: number;
  tabsRead: string[];
  rows: number;
};

/** Extract the spreadsheet id from a full URL or return the id as-is. */
export function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (m ? m[1] : input).trim();
}

// ---- minimal RFC-4180 CSV parser (handles quotes, commas, newlines) ----
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = ""; rows.push(row); row = [];
    } else if (c === "\r") {
      // ignore
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// "4 ივლისი 2026" -> "2026-07-04"
function parseKaDate(raw: string): string | null {
  const m = raw.trim().match(/(\d{1,2})\s+([Ⴀ-ჿ]+)\s+(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const monthIdx = MONTHS_KA.indexOf(m[2]);
  const year = Number(m[3]);
  if (monthIdx < 0 || !day || !year) return null;
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanPhone(raw: string): string | null {
  // strip unicode directional marks (U+202A–U+202E, U+200E/200F) and NBSP
  const p = raw
    .replace(/[‪-‮‎‏ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return p.length >= 5 ? p : null;
}

const STATUS_MAP: Record<string, string> = {
  "დადასტურებული": "confirmed", // დადასტურებული
  confirmed: "confirmed",
  "მოლოდინში": "tentative", // მოლოდინში
  pending: "tentative",
  "რეზერვი": "tentative", // რეზერვი
  "წინასწარი": "tentative", // წინასწარი
  "დასრულებული": "completed", // დასრულებული
  "დასრულებელი": "completed", // დასრულებელი (typo variant)
  "ჩატარებული": "completed", // ჩატარებული
  "გაუქმებული": "cancelled", // გაუქმებული
  "მოთხოვნა": "inquiry", // მოთხოვნა
};

// name-field is junk if empty, all digits/punct (a stray phone), or too short
function isJunkName(name: string): boolean {
  const n = name.trim();
  if (n.length < 2) return true;
  if (/^[0-9+()\-.\s ]+$/.test(n)) return true; // phone accidentally in name
  return false;
}

async function fetchTabCsv(sheetId: string, tab: string): Promise<string[][] | null> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const text = await res.text();
  // Google returns an HTML error page or a JS envelope for a missing sheet.
  if (text.startsWith("<") || text.includes("setResponse")) return null;
  return parseCsv(text);
}

/** Sync bookings from the sheet's monthly tabs into the given venue. */
export async function syncBookingsFromSheet(
  venueId: number,
  sheetIdOrUrl: string,
): Promise<SyncResult> {
  const sheetId = extractSheetId(sheetIdOrUrl);
  const base: SyncResult = { ok: true, added: 0, updated: 0, skipped: 0, tabsRead: [], rows: 0 };
  if (!sheetId) return { ...base, ok: false, error: "Sheet ID ცარიელია" };

  const result = base;

  // preload existing bookings for this venue → match by date + normalized title
  const existing = await db
    .select({
      id: bookings.id,
      eventDate: bookings.eventDate,
      title: bookings.title,
      clientId: bookings.clientId,
    })
    .from(bookings)
    .where(eq(bookings.venueId, venueId));

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const byKey = new Map<string, { id: number; clientId: number | null }>();
  for (const b of existing) byKey.set(`${b.eventDate}|${norm(b.title)}`, { id: b.id, clientId: b.clientId });

  let anyTab = false;
  for (const tab of MONTHS_KA) {
    const grid = await fetchTabCsv(sheetId, tab);
    if (!grid || grid.length < 2) continue;
    const header = grid[0].map((h) => h.trim());
    // must be a monthly booking tab: col0 თარიღი + a სახელი column
    if (!(header[0]?.includes("თარიღი") &&
          header.some((h) => h.includes("სახელი")))) continue;
    anyTab = true;
    result.tabsRead.push(tab);

    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      const date = parseKaDate(row[0] ?? "");
      const rawName = (row[2] ?? "").trim();
      if (!date) continue;
      if (isJunkName(rawName)) {
        if (rawName) result.skipped++;
        continue;
      }
      result.rows++;
      const title = rawName.replace(/\s+/g, " ").trim();
      const guests = Math.round(Number((row[3] ?? "").replace(/[^0-9.]/g, "")) || 0);
      const statusRaw = (row[5] ?? "").trim();
      const status = STATUS_MAP[statusRaw.toLowerCase()] ?? STATUS_MAP[statusRaw] ?? "inquiry";
      const phone = cleanPhone(row[6] ?? "");

      const key = `${date}|${norm(title)}`;
      const found = byKey.get(key);

      if (found) {
        await db
          .update(bookings)
          .set({
            ...(guests > 0 ? { guestCount: guests } : {}),
            status: status as typeof bookings.$inferInsert.status,
          })
          .where(eq(bookings.id, found.id));
        if (phone && found.clientId) {
          await db
            .update(clients)
            .set({ phone })
            .where(and(eq(clients.id, found.clientId), sql`(${clients.phone} is null or ${clients.phone} = '')`));
        }
        result.updated++;
      } else {
        const [client] = await db
          .insert(clients)
          .values({ venueId, name: title, phone: phone ?? null })
          .returning({ id: clients.id });
        await db.insert(bookings).values({
          venueId,
          clientId: client?.id ?? null,
          title,
          eventType: "other",
          eventDate: date,
          guestCount: guests,
          status: status as typeof bookings.$inferInsert.status,
        });
        byKey.set(key, { id: -1, clientId: client?.id ?? null });
        result.added++;
      }
    }
  }

  if (!anyTab) {
    return {
      ...result,
      ok: false,
      error: "თვის ტაბები ვერ წაიკითხა — გააზიარე ცხრილი „ნებისმიერს ბმულით“.",
    };
  }
  return result;
}
