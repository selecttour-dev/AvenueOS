// Event reminders via Telegram — pings the owner 2 and 1 days before an event
// with the client's requirements. Channel-agnostic core + Telegram delivery.

import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { bookings, clients, payments, settings, telegramRecipients } from "@/db/schema";

const MONTHS_KA = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი",
];
const WEEKDAYS_KA = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS_KA[d.getMonth()]}, ${d.getFullYear()} (${WEEKDAYS_KA[d.getDay()]})`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** All distinct chats that recently messaged the bot (each employee's /start). */
export async function resolveTelegramChats(
  token: string,
): Promise<{ chatId: string; name: string }[]> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    if (!res.ok) return [];
    const data = await res.json();
    const updates: any[] = data?.result ?? [];
    const seen = new Map<string, string>();
    for (const u of updates) {
      const chat = u?.message?.chat ?? u?.my_chat_member?.chat;
      if (!chat?.id) continue;
      const name =
        chat.title ??
        [chat.first_name, chat.last_name].filter(Boolean).join(" ") ??
        chat.username ??
        "";
      seen.set(String(chat.id), name);
    }
    return [...seen.entries()].map(([chatId, name]) => ({ chatId, name }));
  } catch {
    return [];
  }
}

/** Recipients for a venue; migrates a legacy single telegramChatId setting. */
export async function getRecipients(
  venueId: number,
): Promise<{ id: number; chatId: string; name: string | null }[]> {
  const rows = await db
    .select({ id: telegramRecipients.id, chatId: telegramRecipients.chatId, name: telegramRecipients.name })
    .from(telegramRecipients)
    .where(eq(telegramRecipients.venueId, venueId));
  // migrate legacy single chat id into the table (one-time)
  const [legacy] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.venueId, venueId), eq(settings.key, "telegramChatId")));
  if (legacy?.value && !rows.some((r) => r.chatId === legacy.value)) {
    const [ins] = await db
      .insert(telegramRecipients)
      .values({ venueId, chatId: legacy.value, name: "მე" })
      .returning({ id: telegramRecipients.id });
    rows.push({ id: ins.id, chatId: legacy.value, name: "მე" });
  }
  return rows;
}

type ReminderRow = {
  id: number;
  title: string;
  eventDate: string;
  eventType: string;
  startTime: string | null;
  guestCount: number;
  status: string;
  pricePerGuest: number;
  extraCharges: number;
  discount: number;
  requirements: string | null;
  notes: string | null;
  reminderSentAt: string | null;
  clientName: string | null;
  clientPhone: string | null;
  paidTotal: number;
};

const STATUS_KA: Record<string, string> = {
  inquiry: "მოთხოვნა",
  tentative: "წინასწარი",
  confirmed: "დადასტურებული",
  completed: "ჩატარებული",
  cancelled: "გაუქმებული",
};

const EVENT_TYPE_KA: Record<string, string> = {
  wedding: "ქორწილი",
  birthday: "დაბადების დღე",
  corporate: "კორპორატივი",
  anniversary: "იუბილე",
  memorial: "ქელეხი",
  other: "სხვა",
};

function gelKa(n: number): string {
  const r = Math.round(n * 100) / 100;
  const [i, d] = String(r).split(".");
  const withSep = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withSep}${d ? "." + d : ""} ₾`;
}

/** One event block — used by reminders and the /ჯავშნები list. */
export function formatEventBlock(b: ReminderRow, opts?: { compact?: boolean }): string {
  const total = b.guestCount * b.pricePerGuest + b.extraCharges - b.discount;
  const balance = total - b.paidTotal;
  const lines = [
    `🎉 <b>${esc(b.title)}</b>`,
    `📅 ${fmtLong(b.eventDate)}${b.startTime ? ` · ${esc(b.startTime)}` : ""}`,
    `👥 ${b.guestCount || "?"} სტუმარი · ${EVENT_TYPE_KA[b.eventType] ?? b.eventType}`,
    `🏷 ${STATUS_KA[b.status] ?? b.status}`,
  ];
  if (b.clientName && b.clientName !== b.title) lines.push(`👤 ${esc(b.clientName)}`);
  if (b.clientPhone) lines.push(`📞 ${esc(b.clientPhone)}`);
  if (total > 0) {
    lines.push(
      `💰 ${gelKa(total)} · გადახდილი ${gelKa(b.paidTotal)}${balance > 0 ? ` · <b>დარჩა ${gelKa(balance)}</b>` : " · ✅ სრულად"}`,
    );
  } else if (b.paidTotal > 0) {
    lines.push(`💰 გადახდილი ${gelKa(b.paidTotal)} (ჯამური ფასი არ არის ჩაწერილი)`);
  } else {
    lines.push(`💰 ფასი არ არის ჩაწერილი`);
  }
  if (!opts?.compact) {
    if (b.requirements?.trim()) {
      lines.push(``, `📝 <b>დამკვეთის სურვილი:</b>`, esc(b.requirements.trim()));
    }
    if (b.notes?.trim()) lines.push(`🗒 ${esc(b.notes.trim())}`);
  }
  return lines.join("\n");
}

function formatReminder(b: ReminderRow, daysUntil: number, venueName: string): string {
  const when = daysUntil === 1 ? "<b>ხვალ</b>" : "<b>ზეგ</b>";
  return [
    `🔔 შეხსენება — ${when} გაქვს ჯავშანი`,
    `🏛 ${esc(venueName)}`,
    ``,
    formatEventBlock(b),
  ].join("\n");
}

const EVENT_FIELDS = {
  id: bookings.id,
  title: bookings.title,
  eventDate: bookings.eventDate,
  eventType: bookings.eventType,
  startTime: bookings.startTime,
  guestCount: bookings.guestCount,
  status: bookings.status,
  pricePerGuest: bookings.pricePerGuest,
  extraCharges: bookings.extraCharges,
  discount: bookings.discount,
  requirements: bookings.requirements,
  notes: bookings.notes,
  reminderSentAt: bookings.reminderSentAt,
  clientName: clients.name,
  clientPhone: clients.phone,
  paidTotal: sql<number>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.bookingId} = ${bookings.id}), 0)::float`,
};

/** Upcoming events for a venue — powers the /ჯავშნები and /დღეს bot commands. */
export async function upcomingEventsMessage(
  venueId: number,
  venueName: string,
  fromDate: string,
  limit = 12,
  onlyDate?: string,
): Promise<string> {
  const rows = (await db
    .select(EVENT_FIELDS)
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(
      and(
        eq(bookings.venueId, venueId),
        onlyDate ? eq(bookings.eventDate, onlyDate) : gte(bookings.eventDate, fromDate),
        ne(bookings.status, "cancelled"),
      ),
    )
    .orderBy(asc(bookings.eventDate))
    .limit(limit)) as ReminderRow[];

  if (rows.length === 0)
    return `🏛 <b>${esc(venueName)}</b>\n\n${onlyDate ? "დღეს ივენთი არ არის." : "მომავალი ჯავშანი არ არის."}`;

  const blocks = rows.map((b) => formatEventBlock(b));
  return [
    `📋 <b>${onlyDate ? "დღევანდელი ივენთები" : "მომავალი ჯავშნები"} — ${esc(venueName)}</b> (${rows.length})`,
    ``,
    blocks.join("\n\n———\n\n"),
  ].join("\n");
}

async function getSetting(venueId: number, key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.venueId, venueId), eq(settings.key, key)));
  return row?.value ?? null;
}

export type ReminderResult = { ok: boolean; error?: string; sent: number; checked: number };

/** Send any due 2-day / 1-day reminders for a venue that hasn't been sent yet. */
export async function runReminders(
  venueId: number,
  venueName: string,
  todayStr: string,
): Promise<ReminderResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN || (await getSetting(venueId, "telegramBotToken"));
  const recipients = await getRecipients(venueId);
  if (!token || recipients.length === 0)
    return { ok: false, error: "Telegram არ არის დაკავშირებული", sent: 0, checked: 0 };

  const d1 = addDays(todayStr, 1);
  const d2 = addDays(todayStr, 2);

  const rows = (await db
    .select(EVENT_FIELDS)
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(
      and(
        eq(bookings.venueId, venueId),
        inArray(bookings.eventDate, [d1, d2]),
        ne(bookings.status, "cancelled"),
      ),
    )) as ReminderRow[];

  let sent = 0;
  for (const b of rows) {
    const daysUntil = b.eventDate === d1 ? 1 : 2;
    const tag = `${b.eventDate}:${daysUntil}`;
    const already = new Set((b.reminderSentAt ?? "").split(",").filter(Boolean));
    if (already.has(tag)) continue;
    const text = formatReminder(b, daysUntil, venueName);
    // send to every recipient; count the event as sent if at least one delivered
    let anyOk = false;
    for (const rcp of recipients) {
      if (await sendTelegram(token, rcp.chatId, text)) anyOk = true;
    }
    if (anyOk) {
      already.add(tag);
      await db
        .update(bookings)
        .set({ reminderSentAt: [...already].join(",") })
        .where(eq(bookings.id, b.id));
      sent++;
    }
  }
  return { ok: true, sent, checked: rows.length };
}
