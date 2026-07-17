// Proactive Telegram digests: a morning brief every day and an owners' report
// on Mondays. Built here, scheduled from /api/sync (hourly cron), sent to all
// telegram_recipients of a venue.

import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { bookings, clients, ledger, payments, settings } from "@/db/schema";
import { esc, gelKa } from "./bot-commands";
import { getPartnersLite } from "./queries";

const MONTHS_KA = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი",
];
const WEEKDAYS_KA = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtKa(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS_KA[d.getMonth()]} (${WEEKDAYS_KA[d.getDay()]})`;
}

/** Current date/hour/weekday in Georgia regardless of server TZ. */
export function tbilisiNow(): { dateISO: string; hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dateISO = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dateISO, hour, weekday: wd };
}

async function ledgerSums(venueId: number, from: string, to: string) {
  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${ledger.type} = 'income' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
      costs: sql<number>`coalesce(sum(case when ${ledger.type} in ('expense','wage') then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
    })
    .from(ledger)
    .where(and(eq(ledger.venueId, venueId), gte(ledger.entryDate, from), lte(ledger.entryDate, to)));
  return { income: row?.income ?? 0, costs: row?.costs ?? 0 };
}

type EventRow = {
  title: string;
  eventDate: string;
  guestCount: number;
  requirements: string | null;
  clientPhone: string | null;
  total: number;
  paid: number;
};

async function eventsBetween(venueId: number, from: string, to: string): Promise<EventRow[]> {
  const rows = await db
    .select({
      title: bookings.title,
      eventDate: bookings.eventDate,
      guestCount: bookings.guestCount,
      requirements: bookings.requirements,
      clientPhone: clients.phone,
      pricePerGuest: bookings.pricePerGuest,
      extraCharges: bookings.extraCharges,
      discount: bookings.discount,
      paid: sql<number>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.bookingId} = ${bookings.id}), 0)::float`,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(
      and(
        eq(bookings.venueId, venueId),
        gte(bookings.eventDate, from),
        lte(bookings.eventDate, to),
        ne(bookings.status, "cancelled"),
      ),
    )
    .orderBy(bookings.eventDate);
  return rows.map((b) => ({
    title: b.title,
    eventDate: b.eventDate,
    guestCount: b.guestCount,
    requirements: b.requirements,
    clientPhone: b.clientPhone,
    total: b.guestCount * b.pricePerGuest + b.extraCharges - b.discount,
    paid: b.paid,
  }));
}

/** ☀️ Morning brief: today's events, yesterday's money, week ahead, unpaid. */
export async function buildDailyDigest(
  venueId: number,
  venueName: string,
  today: string,
): Promise<string> {
  const yesterday = addDays(today, -1);
  const weekEnd = addDays(today, 7);

  const [todayEvents, weekEvents, y] = await Promise.all([
    eventsBetween(venueId, today, today),
    eventsBetween(venueId, addDays(today, 1), weekEnd),
    ledgerSums(venueId, yesterday, yesterday),
  ]);

  const unpaidSoon = [...todayEvents, ...weekEvents].filter((e) => e.total > 0 && e.paid < e.total);
  const unpaidSum = unpaidSoon.reduce((s, e) => s + (e.total - e.paid), 0);

  const lines: string[] = [`☀️ <b>${esc(venueName)}</b> — ${fmtKa(today)}`, ``];

  if (todayEvents.length === 0) {
    lines.push(`📅 დღეს ივენთი არ არის.`);
  } else {
    lines.push(`📅 <b>დღეს:</b>`);
    for (const e of todayEvents) {
      lines.push(`🎉 <b>${esc(e.title)}</b> · ${e.guestCount || "?"} სტუმარი${e.clientPhone ? ` · 📞 ${esc(e.clientPhone)}` : ""}`);
      if (e.requirements?.trim()) lines.push(`   📝 ${esc(e.requirements.trim())}`);
      if (e.total > 0 && e.paid < e.total) lines.push(`   💰 დარჩენილია: <b>${gelKa(e.total - e.paid)}</b>`);
    }
  }

  if (y.income > 0 || y.costs > 0) {
    lines.push(``, `📒 გუშინ: +${gelKa(y.income)} / −${gelKa(y.costs)} · სუფთა <b>${gelKa(y.income - y.costs)}</b>`);
  }

  if (weekEvents.length > 0) {
    lines.push(``, `🗓 უახლოესი 7 დღე — ${weekEvents.length} ივენთი:`);
    for (const e of weekEvents.slice(0, 6)) {
      lines.push(`• ${fmtKa(e.eventDate)} — ${esc(e.title)} (${e.guestCount || "?"} სტ.)`);
    }
    if (weekEvents.length > 6) lines.push(`…და კიდევ ${weekEvents.length - 6}`);
  }

  if (unpaidSum > 0) {
    lines.push(``, `⏳ გადაუხდელი ახლო ივენთებზე: <b>${gelKa(unpaidSum)}</b> (${unpaidSoon.length})`);
  }

  return lines.join("\n");
}

/** 📊 Monday owners' report: last week's money + partner split + week ahead. */
export async function buildWeeklyReport(
  venueId: number,
  venueName: string,
  today: string,
): Promise<string> {
  const from = addDays(today, -7);
  const to = addDays(today, -1);
  const [sums, partners, weekEvents] = await Promise.all([
    ledgerSums(venueId, from, to),
    getPartnersLite(venueId),
    eventsBetween(venueId, today, addDays(today, 6)),
  ]);
  const net = sums.income - sums.costs;

  const lines = [
    `📊 <b>${esc(venueName)}</b> — კვირის ანგარიში`,
    `${fmtKa(from)} → ${fmtKa(to)}`,
    ``,
    `შემოსავალი: <b>${gelKa(sums.income)}</b>`,
    `ხარჯი/ხელფასი: ${gelKa(sums.costs)}`,
    `სუფთა: <b>${gelKa(net)}</b>`,
  ];

  if (partners.length > 0 && net !== 0) {
    lines.push(``, `🤝 განაწილება:`);
    for (const p of partners) {
      lines.push(`• ${esc(p.name)} (${p.sharePct}%): <b>${gelKa((net * p.sharePct) / 100)}</b>`);
    }
  }

  lines.push(``, weekEvents.length === 0 ? `🗓 ამ კვირაში ივენთი არ არის.` : `🗓 ამ კვირაში — ${weekEvents.length} ივენთი:`);
  for (const e of weekEvents.slice(0, 8)) {
    lines.push(`• ${fmtKa(e.eventDate)} — ${esc(e.title)} (${e.guestCount || "?"} სტ.)`);
  }

  return lines.join("\n");
}

/** Idempotence markers so the hourly cron sends each digest once per day. */
export async function shouldSendMarker(
  venueId: number,
  key: string,
  today: string,
): Promise<boolean> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.venueId, venueId), eq(settings.key, key)));
  return row?.value !== today;
}

export async function setSendMarker(venueId: number, key: string, today: string) {
  await db
    .insert(settings)
    .values({ venueId, key, value: today })
    .onConflictDoUpdate({ target: [settings.venueId, settings.key], set: { value: today } });
}
