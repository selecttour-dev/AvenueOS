// Event reminders via Telegram — pings the owner 2 and 1 days before an event
// with the client's requirements. Channel-agnostic core + Telegram delivery.

import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "./db";
import { bookings, clients, settings } from "@/db/schema";

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

/** Find the chat id of whoever last messaged the bot (their /start). */
export async function resolveTelegramChatId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    if (!res.ok) return null;
    const data = await res.json();
    const updates: any[] = data?.result ?? [];
    for (let i = updates.length - 1; i >= 0; i--) {
      const chat = updates[i]?.message?.chat ?? updates[i]?.my_chat_member?.chat;
      if (chat?.id) return String(chat.id);
    }
    return null;
  } catch {
    return null;
  }
}

type ReminderRow = {
  id: number;
  title: string;
  eventDate: string;
  guestCount: number;
  status: string;
  requirements: string | null;
  reminderSentAt: string | null;
  clientPhone: string | null;
};

function formatReminder(b: ReminderRow, daysUntil: number, venueName: string): string {
  const when = daysUntil === 1 ? "<b>ხვალ</b>" : "<b>ზეგ</b>";
  const lines = [
    `🔔 შეხსენება — ${when} ივენთია`,
    ``,
    `🏛 ${esc(venueName)}`,
    `🎉 <b>${esc(b.title)}</b>`,
    `📅 ${fmtLong(b.eventDate)}`,
    `👥 ${b.guestCount || "?"} სტუმარი`,
  ];
  if (b.clientPhone) lines.push(`📞 ${esc(b.clientPhone)}`);
  if (b.requirements?.trim()) {
    lines.push(``, `📝 <b>დამკვეთის სურვილი:</b>`, esc(b.requirements.trim()));
  }
  return lines.join("\n");
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
  const chatId = await getSetting(venueId, "telegramChatId");
  if (!token || !chatId) return { ok: false, error: "Telegram არ არის დაკავშირებული", sent: 0, checked: 0 };

  const d1 = addDays(todayStr, 1);
  const d2 = addDays(todayStr, 2);

  const rows = (await db
    .select({
      id: bookings.id,
      title: bookings.title,
      eventDate: bookings.eventDate,
      guestCount: bookings.guestCount,
      status: bookings.status,
      requirements: bookings.requirements,
      reminderSentAt: bookings.reminderSentAt,
      clientPhone: clients.phone,
    })
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
    const ok = await sendTelegram(token, chatId, formatReminder(b, daysUntil, venueName));
    if (ok) {
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
